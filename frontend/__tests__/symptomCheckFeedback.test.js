// Symptom check feedback: a loading state, no double submit, focus and an announcement when the result
// arrives (and when follow-up answers update it), the urgency indicator and scale, and no repeated sentence.
// Display only: the levels, labels and wording come from the triage API unchanged.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SymptomsPage from "../pages/symptoms";
import UrgencyResult, { URGENCY_SCALE, unrepeatedReasons } from "../components/UrgencyResult";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { addSymptomRecord } from "../lib/symptomApi";
import { assessUrgency, assessUrgencyWithAnswers } from "../lib/triageApi";
import { getEmergencyContact } from "../lib/api";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

jest.setTimeout(PAGE_FLOW_TIMEOUT);

jest.mock("../context/ActiveProfileContext", () => ({ useActiveProfile: jest.fn() }));
jest.mock("../lib/symptomApi", () => ({
  addSymptomRecord: jest.fn(),
  getSymptomsForProfile: jest.fn().mockResolvedValue([]),
  updateSymptomRecord: jest.fn().mockResolvedValue({ id: "symptom-1" }),
}));
jest.mock("../lib/triageApi", () => ({ assessUrgency: jest.fn(), assessUrgencyWithAnswers: jest.fn(), newCheckId: () => "check-test" }));
jest.mock("../lib/api", () => ({ ...jest.requireActual("../lib/api"), getEmergencyContact: jest.fn() }));

const DISCLAIMER = "This is guidance, not a diagnosis. If you think it is an emergency, call 140 now.";
const REPEATED = "Mild, common symptoms like these can usually be managed at home.";

// Shaped like the staging result for "mild headache since yesterday and a runny nose, no fever" (11 Nov 2026).
const ROUTINE = {
  level: "routine",
  label: "Routine / self-care",
  timeframe: "Within a few days, if it does not improve",
  action: "Rest and monitor your symptoms. Book a regular appointment if they last more than a few days or get worse.",
  reasons: ["A mild headache and a runny nose can be signs of a common cold or minor viral illness.", REPEATED],
  ai: { used: true },
  explanation: {
    summary: "We suggest looking after yourself at home for now because you mentioned “runny nose” and “mild headache”.",
    triggers: [{ words: ["runny nose", "mild headache"], meaning: REPEATED }],
    watchFor: ["See a doctor if your symptoms last more than a few days or get worse."],
  },
  disclaimer: DISCLAIMER,
};

const SOON_WITH_QUESTION = {
  level: "soon",
  label: "See a doctor soon",
  timeframe: "Within 24 to 48 hours",
  action: "Book an appointment with a doctor in the next day or two. Get help sooner if it gets worse.",
  reasons: ["A fever should be checked by a doctor if it lasts or gets worse."],
  disclaimer: DISCLAIMER,
  followUpQuestions: [{ id: "fever-temperature", text: "What is the highest temperature you measured?", options: [
    { value: "under-38", label: "Below 38°C" },
    { value: "39.5-plus", label: "39.5°C or higher" },
  ] }],
};

const URGENT = {
  level: "urgent",
  label: "Urgent",
  timeframe: "Within a few hours (today)",
  action: "Get seen today at an emergency department or urgent care clinic. Call 140 if it gets worse.",
  reasons: ["A temperature of 39.5°C or higher should be checked today."],
  confidence: "refined",
  disclaimer: DISCLAIMER,
};

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

describe("Symptom check feedback", () => {
  let scrollIntoView;
  beforeEach(() => {
    jest.clearAllMocks();
    useActiveProfile.mockReturnValue({ activeProfile: { id: "profile-1", fullName: "Maya Hamdan" } });
    addSymptomRecord.mockResolvedValue({ id: "symptom-1" });
    getEmergencyContact.mockResolvedValue({ contact: null });
    scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  test("is called Symptom check, and the box is labelled Symptoms", () => {
    render(<SymptomsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Symptom check" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Symptoms" })).toHaveAttribute("id", "symptoms");
  });

  test("shows Checking... and the heartbeat while it runs, and can't be sent twice", async () => {
    const user = userEvent.setup({ delay: null });
    const pending = deferred();
    assessUrgency.mockReturnValue(pending.promise);
    render(<SymptomsPage />);
    await user.type(screen.getByRole("textbox", { name: "Symptoms" }), "mild headache since yesterday");
    await user.click(screen.getByRole("button", { name: "Submit symptoms" }));

    const button = screen.getByRole("button", { name: "Checking..." });
    expect(button).toBeDisabled();
    expect(screen.getByText("Checking your symptoms").closest('[role="status"]')).toBeInTheDocument();
    await user.click(button);
    expect(assessUrgency).toHaveBeenCalledTimes(1);

    pending.resolve(ROUTINE);
    // The form folds into one line once the result is shown; Edit opens it again, ready to send.
    const edit = await screen.findByRole("button", { name: "Edit what you said" });
    expect(screen.queryByText("Checking your symptoms")).not.toBeInTheDocument();
    expect(screen.getByText("“mild headache since yesterday”")).toBeInTheDocument();
    await user.click(edit);
    expect(screen.getByRole("button", { name: "Submit symptoms" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Symptoms" })).toHaveValue("mild headache since yesterday");
    expect(screen.getByRole("textbox", { name: "Symptoms" })).toHaveFocus();
  });

  test("moves focus to the result, scrolls to it and announces it", async () => {
    const user = userEvent.setup({ delay: null });
    assessUrgency.mockResolvedValue(ROUTINE);
    render(<SymptomsPage />);
    await user.type(screen.getByRole("textbox", { name: "Symptoms" }), "mild headache since yesterday");
    await user.click(screen.getByRole("button", { name: "Submit symptoms" }));

    const heading = await screen.findByRole("heading", { name: "Urgency: Routine / self-care" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalled();
    expect(screen.getByText(/^Result ready\. Urgency: Routine \/ self-care\./)).toHaveAttribute("role", "status");
  });

  test("does the same when follow-up answers update the result", async () => {
    const user = userEvent.setup({ delay: null });
    assessUrgency.mockResolvedValue(SOON_WITH_QUESTION);
    assessUrgencyWithAnswers.mockResolvedValue(URGENT);
    render(<SymptomsPage />);
    await user.type(screen.getByRole("textbox", { name: "Symptoms" }), "fever since yesterday");
    await user.click(screen.getByRole("button", { name: "Submit symptoms" }));
    await screen.findByRole("heading", { name: "Urgency so far: See a doctor soon" });
    scrollIntoView.mockClear();

    await user.click(screen.getByRole("radio", { name: "39.5°C or higher" }));
    await user.click(screen.getByRole("button", { name: "Update my urgency" }));
    const heading = await screen.findByRole("heading", { name: "Urgency: Urgent" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalled();
    expect(screen.getByText(/^Urgency updated\. Urgency: Urgent\./)).toBeInTheDocument();
  });
});

describe("Urgency result card", () => {
  test("starts with ONE mark and the level said once, with how soon and the engine's action", () => {
    render(<UrgencyResult result={ROUTINE} />);
    const result = screen.getByRole("heading", { name: "Urgency: Routine / self-care" }).closest("section");
    const indicator = result.querySelector(".urgency__indicator");
    expect(result.firstElementChild).toBe(indicator);
    // One mark (the Held ring), no second icon anywhere on the result.
    expect([...result.querySelectorAll("svg")].filter((svg) => !svg.closest("summary, .urgency__actions"))).toHaveLength(1);
    expect(indicator.querySelector("svg.held.held--done")).not.toBeNull();
    expect(indicator).toHaveTextContent(`How soon: ${ROUTINE.timeframe}`);
    expect(within(indicator).getByText(ROUTINE.action, { exact: false })).toHaveClass("urgency__action");
    // The label is written once where people see it (the scale repeats it for screen readers only).
    const visible = [...result.querySelectorAll("*")].filter((el) => el.children.length === 0 && !el.closest(".urgency-scale"));
    expect(visible.filter((el) => el.textContent.includes("Routine / self-care"))).toHaveLength(1);
  });

  test.each([
    ["routine", "Routine / self-care"],
    ["soon", "See a doctor soon"],
    ["urgent", "Urgent"],
    ["emergency", "Emergency"],
  ])("the 4-step scale marks %s with its label and text for screen readers, not colour alone", (level, label) => {
    render(<UrgencyResult result={{ ...ROUTINE, level, label, explanation: null, reasons: [] }} />);
    const scale = screen.getByRole("list", { name: "Urgency scale, from lowest to highest" });
    const steps = within(scale).getAllByRole("listitem");
    expect(steps.map((step) => step.querySelector(".urgency-scale__name").textContent)).toEqual(["Routine / self-care", "See a doctor soon", "Urgent", "Emergency"]);
    const current = steps.filter((step) => step.getAttribute("aria-current") === "step");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(label);
    expect(current[0]).toHaveTextContent("This result");
    // The level is written out for screen readers; the eye gets it from the header ("Urgency: <label>").
    const index = ["routine", "soon", "urgent", "emergency"].indexOf(level) + 1;
    expect(scale.closest(".urgency-scale").querySelector(".urgency-scale__level")).toHaveTextContent(`Level ${index} of 4: ${label}`);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(`Urgency: ${label}`);
  });

  test("the scale uses exactly the four triage levels, lowest first", () => {
    expect(URGENCY_SCALE.map(([level]) => level)).toEqual(["routine", "soon", "urgent", "emergency"]);
  });

  test("a sentence already shown under What you told us isn't repeated in What the AI check noted", () => {
    render(<UrgencyResult result={ROUTINE} />);
    expect(screen.getAllByText(REPEATED, { exact: false })).toHaveLength(1);
    expect(screen.getByText("A mild headache and a runny nose can be signs of a common cold or minor viral illness.")).toBeInTheDocument();
  });

  test("keeps every reason when nothing repeats, and ignores spacing and case when comparing", () => {
    expect(unrepeatedReasons(["One.", "Two."], { summary: "Other.", triggers: [] })).toEqual(["One.", "Two."]);
    expect(unrepeatedReasons([" mild,  COMMON symptoms like these can usually be managed at home. "], ROUTINE.explanation)).toEqual([]);
  });

  test("emergencies keep role alert; other results are announced by the page instead", () => {
    const { rerender } = render(<UrgencyResult result={{ ...ROUTINE, level: "emergency", label: "Emergency", explanation: null }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Urgency: Emergency");
    rerender(<UrgencyResult result={ROUTINE} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Nabad assistant on the symptom check", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActiveProfile.mockReturnValue({ activeProfile: { id: "profile-1", fullName: "Maya Hamdan" } });
    addSymptomRecord.mockResolvedValue({ id: "symptom-1" });
    getEmergencyContact.mockResolvedValue({ contact: null });
    Element.prototype.scrollIntoView = jest.fn();
  });

  test("the loader is the turning Held mark, announced only as Checking your symptoms", async () => {
    const user = userEvent.setup({ delay: null });
    assessUrgency.mockReturnValue(new Promise(() => {}));
    render(<SymptomsPage />);
    await user.type(screen.getByRole("textbox", { name: "Symptoms" }), "mild headache since yesterday");
    await user.click(screen.getByRole("button", { name: "Submit symptoms" }));
    const loader = screen.getByText("Checking your symptoms").closest('[role="status"]');
    const mark = loader.querySelector("svg.held.held--thinking");
    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(loader).toHaveTextContent(/^Checking your symptoms$/);
  });

  test("shows in the empty history while calm, and never next to an urgent or emergency result", async () => {
    const user = userEvent.setup({ delay: null });
    addSymptomRecord.mockRejectedValue(new Error("offline")); // keep the history empty after the check
    assessUrgency.mockResolvedValue(URGENT);
    render(<SymptomsPage />);
    expect(document.querySelectorAll(".nabad-assistant")).toHaveLength(1);
    await user.type(screen.getByRole("textbox", { name: "Symptoms" }), "high fever since this morning");
    await user.click(screen.getByRole("button", { name: "Submit symptoms" }));
    await screen.findByRole("heading", { name: "Urgency: Urgent" });
    expect(document.querySelectorAll(".nabad-assistant")).toHaveLength(0);
  });
});
