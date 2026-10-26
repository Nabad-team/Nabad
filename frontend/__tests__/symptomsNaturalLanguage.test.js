// SCRUM-125 (backlog #24): "As a user, I want to describe my symptoms in natural language, by text
// or voice, so that the AI understands my situation."
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import SymptomsPage from "../pages/symptoms";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { useAccessibility } from "../context/AccessibilityContext";
import { addSymptomRecord } from "../lib/symptomApi";
import { assessUrgency, assessUrgencyWithAnswers } from "../lib/triageApi";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

jest.setTimeout(PAGE_FLOW_TIMEOUT);

jest.mock("../context/ActiveProfileContext", () => ({ useActiveProfile: jest.fn() }));
jest.mock("../context/AccessibilityContext", () => ({ useAccessibility: jest.fn() }));
jest.mock("../lib/symptomApi", () => ({
  addSymptomRecord: jest.fn(),
  getSymptomsForProfile: jest.fn().mockResolvedValue([]),
  updateSymptomRecord: jest.fn().mockResolvedValue({ id: "symptom-1" }),
}));
let mockChecks = 0;
jest.mock("../lib/triageApi", () => ({ assessUrgency: jest.fn(), assessUrgencyWithAnswers: jest.fn(), newCheckId: () => `check-${++mockChecks}` }));

const RESULT = {
  level: "emergency",
  label: "Emergency",
  timeframe: "Now",
  action: "Call 140 (Lebanese Red Cross) or go to the nearest emergency department immediately.",
  reasons: ["Chest pain or pressure can be a sign of a heart attack."],
  followUpQuestions: [],
  disclaimer: "This is guidance, not a diagnosis. If you think it is an emergency, call 140 now.",
  explanation: {
    summary: "We suggest getting emergency care now because you mentioned “chest hurts”.",
    triggers: [{ words: ["chest hurts"], meaning: "Chest pain or pressure can be a sign of a heart attack." }],
    changedBy: [],
    notCounted: [],
    watchFor: ["Don't wait to see if it gets better. Call 140 or go to the nearest emergency department now."],
    basedOn: "Nabad's safety rules, which look for known warning signs in what you wrote.",
  },
};

function setUp({ simplifiedMode = false } = {}) {
  useActiveProfile.mockReturnValue({ activeProfile: { id: "profile-1", fullName: "Maya Hamdan" } });
  useAccessibility.mockReturnValue({ preferences: { simplifiedMode } });
  addSymptomRecord.mockResolvedValue({ id: "symptom-1" });
  return userEvent.setup({ delay: null });
}

beforeEach(() => {
  jest.clearAllMocks();
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
});

describe("describing symptoms in your own words", () => {
  test("tells the user that their own words are fine, and what details help", () => {
    setUp();
    render(<SymptomsPage />);
    expect(screen.getByLabelText("Symptoms")).toHaveAccessibleDescription(
      "Use your own words, by typing or speaking. Say what you feel, where, since when, and how bad it is."
    );
  });

  test("simplified mode gives a shorter tip", () => {
    setUp({ simplifiedMode: true });
    render(<SymptomsPage />);
    expect(screen.getByLabelText("Symptoms")).toHaveAccessibleDescription("Say it in your own words.");
  });

  test("simplified mode says the description goes to Google's Gemini AI", () => {
    setUp({ simplifiedMode: true });
    render(<SymptomsPage />);
    expect(screen.getByText(/sent over an encrypted connection to Google's Gemini AI service/)).toBeInTheDocument();
    expect(screen.getByText(/Emergencies are not sent/)).toBeInTheDocument();
    expect(screen.queryByText(/train AI/)).not.toBeInTheDocument();
  });

  test("everyday words are sent as written to the AI assessment", async () => {
    const user = setUp();
    assessUrgency.mockResolvedValue(RESULT);
    render(<SymptomsPage />);
    await user.type(screen.getByLabelText("Symptoms"), "my chest hurts really bad");
    await user.click(screen.getByRole("button", { name: "Submit symptoms" }));
    await waitFor(() => expect(assessUrgency).toHaveBeenCalledWith("my chest hurts really bad", "profile-1", expect.any(String)));
    expect(await screen.findByText(RESULT.explanation.summary)).toBeInTheDocument();
  });

  test("follow-up answers go to the AI assessment with the same description", async () => {
    const user = setUp();
    assessUrgency.mockResolvedValue({
      ...RESULT,
      level: "soon",
      label: "See a doctor soon",
      followUpQuestions: [{ id: "severity", text: "How bad are the symptoms right now?", options: [{ value: "mild", label: "Mild" }] }],
    });
    assessUrgencyWithAnswers.mockResolvedValue({ ...RESULT, level: "soon", label: "See a doctor soon" });
    render(<SymptomsPage />);
    await user.type(screen.getByLabelText("Symptoms"), "i feel feverish");
    await user.click(screen.getByRole("button", { name: "Submit symptoms" }));
    await user.click(await screen.findByLabelText("Mild"));
    await user.click(screen.getByRole("button", { name: "Update my urgency" }));
    await waitFor(() => expect(assessUrgencyWithAnswers).toHaveBeenCalledWith("i feel feverish", { severity: "mild" }, "profile-1", expect.any(String), null)); // SCRUM-280: no followUpState in this mock
    // The answers belong to the same check, so the care circle is alerted at most once for it.
    expect(assessUrgencyWithAnswers.mock.calls.at(-1)[3]).toBe(assessUrgency.mock.calls.at(-1)[2]);
  });

  test("a description that is too short is not sent, and the user is told what to write", async () => {
    const user = setUp();
    render(<SymptomsPage />);
    await user.type(screen.getByLabelText("Symptoms"), "ow");
    await user.click(screen.getByRole("button", { name: "Submit symptoms" }));
    expect(screen.getByText(/Please describe your symptoms in a few words/)).toBeInTheDocument();
    expect(addSymptomRecord).not.toHaveBeenCalled();
    expect(assessUrgency).not.toHaveBeenCalled();
  });

  test("the box accepts at most 2000 characters, the same limit as the server", () => {
    setUp();
    render(<SymptomsPage />);
    expect(screen.getByLabelText("Symptoms")).toHaveAttribute("maxLength", "2000");
  });

  test("the character count only appears when the description gets long", () => {
    setUp();
    render(<SymptomsPage />);
    const box = screen.getByLabelText("Symptoms");
    fireEvent.change(box, { target: { value: "x".repeat(1499) } });
    expect(screen.queryByText(/of 2000 characters/)).not.toBeInTheDocument();
    fireEvent.change(box, { target: { value: "x".repeat(1500) } });
    expect(screen.getByText("1500 of 2000 characters")).toBeInTheDocument();
  });

  test("a long dictation is cut at the limit instead of being rejected by the server", async () => {
    const user = setUp();
    let recognition;
    window.SpeechRecognition = jest.fn(() => {
      recognition = { start: jest.fn(), stop: jest.fn(), abort: jest.fn() };
      return recognition;
    });
    render(<SymptomsPage />);
    await user.click(screen.getByRole("button", { name: "Speak symptoms" }));
    await act(async () => {
      recognition.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "my head hurts ".repeat(200) } }] });
    });
    expect(screen.getByLabelText("Symptoms").value.length).toBe(2000);
  });

  test("dictated everyday words are sent like typed ones", async () => {
    const user = setUp();
    assessUrgency.mockResolvedValue(RESULT);
    let recognition;
    window.SpeechRecognition = jest.fn(() => {
      recognition = { start: jest.fn(), stop: jest.fn(), abort: jest.fn() };
      return recognition;
    });
    render(<SymptomsPage />);
    await user.click(screen.getByRole("button", { name: "Speak symptoms" }));
    await act(async () => {
      recognition.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "i cant catch my breath" } }] });
    });
    await user.click(screen.getByRole("button", { name: "Submit symptoms" }));
    await waitFor(() => expect(assessUrgency).toHaveBeenCalledWith("i cant catch my breath", "profile-1", expect.any(String)));
  });

  test("too many checks: the server's message (with when to call 140) is shown", async () => {
    const user = setUp();
    const limited = Object.assign(new Error("Too many symptom checks in a short time. Please wait a few minutes and try again. If this is an emergency, call 140 now."), { status: 429 });
    assessUrgency.mockRejectedValue(limited);
    render(<SymptomsPage />);
    await user.type(screen.getByLabelText("Symptoms"), "a cough");
    await user.click(screen.getByRole("button", { name: "Submit symptoms" }));
    expect(await screen.findByText(limited.message)).toBeInTheDocument();
   expect(addSymptomRecord).not.toHaveBeenCalled(); 
  });
});
