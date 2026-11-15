// The dashboard's Getting started card (lib/gettingStarted.js, components/GettingStartedCard.js) and the Next step
// capitalisation fix (lib/nextStep.js).
import fs from "fs";
import path from "path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import DashboardFirstSteps from "../components/GettingStartedCard";
import GettingStartedSetting from "../components/GettingStartedSetting";
import { emergencyCardHasContent, gettingStartedSteps, progressText } from "../lib/gettingStarted";
import { pickNextStep, sentence } from "../lib/nextStep";
import { getMe, hideGettingStarted, showGettingStarted } from "../lib/api";

jest.mock("../lib/api", () => ({ getMe: jest.fn(), hideGettingStarted: jest.fn(), showGettingStarted: jest.fn() }));

const FULL_HEALTH = { dateOfBirth: "1990-04-12", facts: ["sex", "height", "weight", "bloodType"].map((category) => ({ category })) };
const EMPTY = { health: { dateOfBirth: "", facts: [] }, medications: [], symptoms: [], emergencyCard: { emergencyContact: null, bloodType: "", conditions: [], allergies: [], medications: [] } };
const HALF = { ...EMPTY, health: FULL_HEALTH, medications: [{ id: "m1", name: "Metformin", times: [] }] };
const DONE = { ...HALF, symptoms: [{ id: "s1" }], emergencyCard: { ...EMPTY.emergencyCard, emergencyContact: { name: "Sami", phone: "71123456" } } };
// What useDashboardData() returns once everything has answered.
const loaded = (sources) => ({ ...sources, wellbeing: { sleep: null }, appointments: [], loaded: true, startLoaded: true });
const NOON = new Date("2026-11-16T10:00:00Z");

async function renderSlot(sources, props = {}) {
  let result;
  await act(async () => {
    result = render(<main><h1>Welcome, Rania</h1><DashboardFirstSteps data={loaded(sources)} now={NOON} {...props} /></main>);
  });
  return result;
}

beforeEach(() => {
  getMe.mockReset().mockResolvedValue({ user: { gettingStartedHidden: false } });
  hideGettingStarted.mockReset().mockResolvedValue({ gettingStartedHidden: true });
});

describe("each step is ticked from data the account already has", () => {
  const done = (sources) => Object.fromEntries(gettingStartedSteps(sources).map((step) => [step.key, step.done]));

  test("a brand-new profile has nothing done", () => {
    expect(done(EMPTY)).toEqual({ health: false, medication: false, symptoms: false, "emergency-card": false });
    expect(progressText(gettingStartedSteps(EMPTY))).toBe("0 of 4 done");
  });

  test("health basics: all five of date of birth, sex, height, weight and blood type", () => {
    expect(done({ ...EMPTY, health: { ...FULL_HEALTH, dateOfBirth: "" } }).health).toBe(false);
    expect(done({ ...EMPTY, health: { dateOfBirth: "1990-04-12", facts: [{ category: "sex" }] } }).health).toBe(false);
    expect(done({ ...EMPTY, health: FULL_HEALTH }).health).toBe(true);
  });

  test("a medication: at least one", () => {
    expect(done({ ...EMPTY, medications: [{ id: "m1" }] }).medication).toBe(true);
  });

  test("a symptom check: at least one saved", () => {
    expect(done({ ...EMPTY, symptoms: [{ id: "s1" }] }).symptoms).toBe(true);
  });

  test("the emergency card has content: a contact, condition or allergy (blood type and medications are steps 1 and 2)", () => {
    const card = EMPTY.emergencyCard;
    expect(emergencyCardHasContent(null)).toBe(false);
    expect(emergencyCardHasContent({ ...card, medications: [{ name: "Metformin" }] })).toBe(false);
    expect(emergencyCardHasContent({ ...card, emergencyContact: { name: "Sami", phone: "71123456" } })).toBe(true);
    expect(emergencyCardHasContent({ ...card, bloodType: "O+" })).toBe(false);
    expect(emergencyCardHasContent({ ...card, conditions: [{ code: "asthma" }] })).toBe(true);
    expect(emergencyCardHasContent({ ...card, allergies: [{ name: "Penicillin" }] })).toBe(true);
  });

  test("progress is written out", () => {
    expect(progressText(gettingStartedSteps(HALF))).toBe("2 of 4 done");
    expect(progressText(gettingStartedSteps(DONE))).toBe("4 of 4 done");
  });
});

describe("the card on the dashboard", () => {
  test("a new account sees Getting started instead of Next step, with one button per step and 0 of 4 done", async () => {
    await renderSlot(EMPTY);
    const card = screen.getByRole("region", { name: "Getting started" });
    expect(within(card).getByText("0 of 4 done")).toBeInTheDocument();
    expect(within(card).getAllByRole("listitem")).toHaveLength(4);
    expect(within(card).getByRole("link", { name: "Open my health" })).toHaveAttribute("href", "/my-health");
    expect(within(card).getByRole("link", { name: "Open my medications" })).toHaveAttribute("href", "/medications");
    expect(within(card).getByRole("link", { name: "Check symptoms" })).toHaveAttribute("href", "/symptoms");
    expect(within(card).getByRole("link", { name: "Open the card" })).toHaveAttribute("href", "/emergency-card");
    // Next step would say "Add your health basics for safer guidance": it must not compete.
    expect(screen.queryByRole("region", { name: "Next step" })).toBeNull();
    expect(document.body).not.toHaveTextContent(/streak|hurry|don't miss/i);
  });

  test("a half-done account: done steps are ticked without a button, the others keep theirs", async () => {
    await renderSlot(HALF);
    const card = screen.getByRole("region", { name: "Getting started" });
    expect(within(card).getByText("2 of 4 done")).toBeInTheDocument();
    expect(within(card).getByText("Add your health basics").closest("p")).toHaveTextContent("Done: Add your health basics");
    expect(within(card).queryByRole("link", { name: "Open my health" })).toBeNull();
    expect(within(card).getByRole("link", { name: "Check symptoms" })).toBeInTheDocument();
  });

  test("Hide is saved on the server for the account, the card goes, Next step returns and focus moves to the title", async () => {
    await renderSlot(EMPTY);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Hide" })); });
    expect(hideGettingStarted).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("region", { name: "Getting started" })).toBeNull();
    expect(screen.getByRole("region", { name: "Next step" })).toHaveTextContent("Add your health basics for safer guidance");
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  test("if hiding fails, the card stays and says so", async () => {
    hideGettingStarted.mockRejectedValue(new Error("offline"));
    await renderSlot(EMPTY);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Hide" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't hide the card.");
    expect(screen.getByRole("region", { name: "Getting started" })).toBeInTheDocument();
  });

  test("once hidden on the server, it never shows again, on any profile", async () => {
    getMe.mockResolvedValue({ user: { gettingStartedHidden: true } });
    await renderSlot(EMPTY);
    expect(screen.queryByRole("region", { name: "Getting started" })).toBeNull();
    expect(screen.getByRole("region", { name: "Next step" })).toBeInTheDocument();
    await renderSlot(EMPTY, { forName: "Sami", isSelf: false });
    expect(screen.queryByRole("region", { name: "Getting started" })).toBeNull();
  });

  test("all four done on your own profile: gone, and remembered so it stays gone", async () => {
    await renderSlot(DONE);
    expect(screen.queryByRole("region", { name: "Getting started" })).toBeNull();
    expect(hideGettingStarted).toHaveBeenCalledTimes(1);
  });

  test("Acting for: the steps are the family member's, named, and finishing theirs doesn't hide yours", async () => {
    await renderSlot(HALF, { forName: "Sami", isSelf: false });
    const card = screen.getByRole("region", { name: "Getting started" });
    expect(card).toHaveTextContent("A few first steps for Sami, whenever you're ready.");
    expect(within(card).getAllByRole("listitem").map((item) => item.querySelector(".getting-started__title").textContent.replace("Done: ", ""))).toEqual([
      "Add Sami's health basics", "Add a medication Sami takes", "Try a symptom check for Sami", "Set up Sami's emergency information card",
    ]);
    document.body.innerHTML = "";
    await renderSlot(DONE, { forName: "Sami", isSelf: false });
    expect(screen.queryByRole("region", { name: "Getting started" })).toBeNull();
    expect(hideGettingStarted).not.toHaveBeenCalled();
  });

  test("while loading it holds the Next step placeholder, and if a source fails it falls back to Next step", async () => {
    let result;
    await act(async () => { result = render(<DashboardFirstSteps data={{ ...loaded(EMPTY), startLoaded: false }} now={NOON} />); });
    expect(result.container.querySelector('.skeleton[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole("region", { name: "Getting started" })).toBeNull();
    result.unmount();
    await renderSlot({ ...EMPTY, symptoms: null, symptomsFailed: true });
    expect(screen.queryByRole("region", { name: "Getting started" })).toBeNull();
    expect(screen.getByRole("region", { name: "Next step" })).toBeInTheDocument();
  });

  test("only on the dashboard: never on the symptom check or its urgent and emergency results", () => {
    const root = path.join(__dirname, "..");
    const users = ["pages", "components"].flatMap(function walk(dir) {
      return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
        const relative = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(relative);
        return entry.name.endsWith(".js") && /GettingStartedCard/.test(fs.readFileSync(path.join(root, relative), "utf8")) ? [relative] : [];
      });
    }).filter((file) => !file.endsWith("GettingStartedCard.js"));
    expect(users).toEqual([path.join("pages", "dashboard.js")]);
  });
});

describe("Show getting started again (My profile)", () => {
  test("only while it is hidden; clears the flag on the server and says so", async () => {
    getMe.mockResolvedValue({ user: { gettingStartedHidden: true } });
    showGettingStarted.mockReset().mockResolvedValue({ gettingStartedHidden: false });
    await act(async () => { render(<GettingStartedSetting />); });
    expect(screen.getByText("The Getting started card on your dashboard is hidden.")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Show getting started again" })); });
    expect(showGettingStarted).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Getting started will show on your dashboard again.");
    expect(screen.getByRole("link", { name: "Go to the dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("button", { name: "Show getting started again" })).toBeNull();
  });

  test("shows nothing while the card isn't hidden", async () => {
    let result;
    await act(async () => { result = render(<GettingStartedSetting />); });
    expect(result.container).toBeEmptyDOMElement();
  });

  test("if it fails, it says so and keeps the button", async () => {
    getMe.mockResolvedValue({ user: { gettingStartedHidden: true } });
    showGettingStarted.mockReset().mockRejectedValue(new Error("offline"));
    await act(async () => { render(<GettingStartedSetting />); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Show getting started again" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't change that.");
    expect(screen.getByRole("button", { name: "Show getting started again" })).toBeEnabled();
  });
});

describe("Next step capitalises a sentence that starts with something the user typed", () => {
  const appointment = { title: "checking on my date", appointmentDate: "2026-11-16", appointmentTime: "18:00" };
  test("your own appointment", () => {
    expect(pickNextStep({ medications: [], appointments: [appointment], basicsFilled: 5, wellbeing: { sleep: {} }, now: NOON }).text)
      .toBe("Checking on my date today: prepare your visit");
  });
  test("a family member's appointment", () => {
    expect(pickNextStep({ medications: [], appointments: [appointment], basicsFilled: 5, wellbeing: { sleep: {} }, now: NOON, forName: "Sami" }).text)
      .toBe("Checking on my date for Sami today: prepare the visit");
  });
  test("leaves the rest of the sentence alone", () => {
    expect(sentence("Cardiology check-up")).toBe("Cardiology check-up");
    expect(sentence("")).toBe("");
  });
});
