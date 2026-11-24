// The dashboard's first steps (lib/gettingStarted.js, components/GettingStartedCard.js, shown as To do tags on
// components/YourHealth.js) and the Next step
// capitalisation fix (lib/nextStep.js).
import fs from "fs";
import path from "path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextStepSlot, useFirstSteps } from "../components/GettingStartedCard";
import YourHealth from "../components/YourHealth";
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
const loaded = (sources) => ({ ...sources, wellbeing: { sleep: null }, appointments: [], loaded: true, startLoaded: true, profileId: "self", profileRef: { current: "self" }, setMedications: () => {} });
const EMPTY_STEPS_FOR = (forName) => gettingStartedSteps(EMPTY, forName);

// The dashboard's first steps, placed as pages/dashboard.js places them: Next step, and Your health with its To do tags.
function FirstSteps({ data, forName = "", isSelf = true, now }) {
  const firstSteps = useFirstSteps({ data, forName, isSelf });
  return (
    <>
      <NextStepSlot firstSteps={firstSteps} data={data} forName={forName} now={now} />
      <YourHealth data={data} firstSteps={firstSteps} forName={forName} />
    </>
  );
}
const NOON = new Date("2026-11-16T10:00:00Z");

async function renderSlot(sources, props = {}) {
  let result;
  await act(async () => {
    result = render(<main><h1>Welcome, Rania</h1><FirstSteps data={loaded(sources)} now={NOON} {...props} /></main>);
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

describe("the first steps on the dashboard (To do tags on Your health)", () => {
  // The four steps' tiles, by their link name's start.
  const TILES = { health: "My health", medication: "Medicines", symptoms: "Symptom checks", "emergency-card": "Emergency card" };
  const tile = (key) => screen.getByRole("link", { name: new RegExp(`^${TILES[key]}`) });
  const todoTags = () => [...document.querySelectorAll(".tile__tag")];

  test("a new account sees the four first steps instead of Next step: a To do tag on each tile and 0 of 4 done", async () => {
    await renderSlot(EMPTY);
    const section = screen.getByRole("region", { name: "Your health" });
    // The heading row: a small ring, "Setup 0/4" (said as "0 of 4 first steps done") and Hide.
    const setup = section.querySelector(".your-health__setup");
    expect(setup).toHaveTextContent("Setup 0/4");
    expect(setup).toHaveTextContent("0 of 4 first steps done");
    expect(setup.querySelector("svg.setup-ring")).toHaveAttribute("aria-hidden", "true");
    expect(todoTags()).toHaveLength(4);
    expect(tile("health")).toHaveAttribute("href", "/my-health");
    expect(tile("medication")).toHaveAttribute("href", "/medications");
    expect(tile("symptoms")).toHaveAttribute("href", "/symptoms");
    expect(tile("emergency-card")).toHaveAttribute("href", "/emergency-card");
    for (const key of Object.keys(TILES)) expect(within(tile(key)).getByText("To do")).toBeInTheDocument();
    // Next step would say "Add your health basics for safer guidance": it must not compete.
    expect(screen.queryByRole("region", { name: "Next step" })).toBeNull();
    expect(document.body).not.toHaveTextContent(/streak|hurry|don't miss/i);
  });

  test("a half-done account: done steps lose their tag, the others keep theirs", async () => {
    await renderSlot(HALF);
    expect(document.querySelector(".your-health__setup")).toHaveTextContent("Setup 2/4");
    expect(within(tile("health")).queryByText("To do")).toBeNull();
    expect(within(tile("medication")).queryByText("To do")).toBeNull();
    expect(within(tile("symptoms")).getByText("To do")).toBeInTheDocument();
    expect(todoTags()).toHaveLength(2);
  });

  test("Hide is saved on the server for the account, the tags go, Next step returns and focus moves to the title", async () => {
    await renderSlot(EMPTY);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Hide" })); });
    expect(hideGettingStarted).toHaveBeenCalledTimes(1);
    expect(todoTags()).toHaveLength(0);
    expect(screen.queryByText(/First steps/)).toBeNull();
    expect(document.querySelector(".your-health__setup, svg.setup-ring")).toBeNull();
    expect(screen.getByRole("region", { name: "Next step" })).toHaveTextContent("Add your health basics for safer guidance");
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  test("if hiding fails, the first steps stay and it says so", async () => {
    hideGettingStarted.mockRejectedValue(new Error("offline"));
    await renderSlot(EMPTY);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Hide" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't hide the first steps.");
    expect(todoTags()).toHaveLength(4);
  });

  test("once hidden on the server, they never show again, on any profile", async () => {
    getMe.mockResolvedValue({ user: { gettingStartedHidden: true } });
    await renderSlot(EMPTY);
    expect(todoTags()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Hide" })).toBeNull();
    expect(screen.getByRole("region", { name: "Next step" })).toBeInTheDocument();
    document.body.innerHTML = "";
    await renderSlot(EMPTY, { forName: "Sami", isSelf: false });
    expect(todoTags()).toHaveLength(0);
  });

  test("all four done on your own profile: the tags go, and it's remembered so they stay gone", async () => {
    await renderSlot(DONE);
    expect(todoTags()).toHaveLength(0);
    expect(screen.queryByText(/First steps/)).toBeNull();
    expect(document.querySelector(".your-health__setup, svg.setup-ring")).toBeNull();
    expect(hideGettingStarted).toHaveBeenCalledTimes(1);
  });

  test("Acting for: the steps are the family member's, named, and finishing theirs doesn't hide yours", async () => {
    await renderSlot(HALF, { forName: "Sami", isSelf: false });
    expect(document.querySelector(".your-health__setup")).toHaveTextContent("Setup 2/4 for Sami: 2 of 4 first steps done");
    expect(EMPTY_STEPS_FOR("Sami").map((step) => step.text)).toEqual([
      "Add Sami's health basics", "Add a medication Sami takes", "Try a symptom check for Sami", "Set up Sami's emergency information card",
    ]);
    // Each tag tells screen readers which step it is.
    expect(todoTags().map((tag) => tag.textContent)).toEqual(["To do: Try a symptom check for Sami", "To do: Set up Sami's emergency information card"]);
    document.body.innerHTML = "";
    await renderSlot(DONE, { forName: "Sami", isSelf: false });
    expect(todoTags()).toHaveLength(0);
    expect(hideGettingStarted).not.toHaveBeenCalled();
  });

  test("while loading it holds the Next step placeholder, and if a source fails it falls back to Next step", async () => {
    let result;
    await act(async () => { result = render(<FirstSteps data={{ ...loaded(EMPTY), startLoaded: false }} now={NOON} />); });
    expect(result.container.querySelector('.skeleton[aria-hidden="true"]')).not.toBeNull();
    expect(todoTags()).toHaveLength(0);
    result.unmount();
    await renderSlot({ ...EMPTY, symptoms: null, symptomsFailed: true });
    expect(todoTags()).toHaveLength(0);
    expect(screen.getByRole("region", { name: "Next step" })).toBeInTheDocument();
  });

  test("the setup ring fills with the steps done and disappears with its text when everything is done", async () => {
    await renderSlot(HALF);
    const ring = document.querySelector(".your-health__setup svg.setup-ring");
    const value = ring.querySelector(".setup-ring__value");
    const circumference = Number(value.getAttribute("stroke-dasharray"));
    expect(Number(value.getAttribute("stroke-dashoffset"))).toBeCloseTo(circumference / 2, 5);
    expect(screen.getByRole("button", { name: "Hide" })).toHaveClass("link-button");
    document.body.innerHTML = "";
    await renderSlot(DONE);
    expect(document.querySelector(".your-health__setup")).toBeNull();
    expect(document.querySelector("svg.setup-ring")).toBeNull();
    expect(screen.queryByText(/Setup/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Hide" })).toBeNull();
  });

  test("only on the dashboard: never on the symptom check or its urgent and emergency results", () => {
    const root = path.join(__dirname, "..");
    const users = (pattern) => ["pages", "components"].flatMap(function walk(dir) {
      return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
        const relative = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(relative);
        return entry.name.endsWith(".js") && pattern.test(fs.readFileSync(path.join(root, relative), "utf8")) ? [relative] : [];
      });
    });
    expect(users(/GettingStartedCard/).filter((file) => !file.endsWith("GettingStartedCard.js"))).toEqual([path.join("pages", "dashboard.js")]);
    expect(users(/components\/YourHealth|"\.\/YourHealth"/)).toEqual([path.join("pages", "dashboard.js")]);
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
