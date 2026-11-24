// Wellbeing exercises (lib/wellbeingExercises.js, components/wellbeing/, pages/wellbeing.js): breathing timing,
// reduced motion, the reset order, the question of the day around Beirut midnight, and 140 and 1564 always shown.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import {
  BREATHING_PHASES, BREATHING_ROUNDS, BREATHING_TOTAL_SECONDS, EXERCISES, GROUNDING_STEPS, REFLECTION_QUESTIONS, RESET_STEPS,
  HELP_SENTENCE, beirutDayNumber, breathingStateAt, nextResetStep, reflectionQuestionFor,
} from "../lib/wellbeingExercises";
import BreathingExercise from "../components/wellbeing/BreathingExercise";
import GroundingExercise from "../components/wellbeing/GroundingExercise";
import ResetExercise from "../components/wellbeing/ResetExercise";
import WindDown from "../components/wellbeing/WindDown";
import WellbeingPage from "../pages/wellbeing";
import WellbeingCorner from "../components/WellbeingCorner";
import UrgencyResult from "../components/UrgencyResult";

let mockQuery = {};
const mockReplace = jest.fn();
jest.mock("next/router", () => ({ useRouter: () => ({ query: mockQuery, replace: mockReplace, asPath: "/wellbeing" }) }));
jest.mock("../components/ProfileHeader", () => () => <div />);
jest.mock("next/head", () => ({ __esModule: true, default: ({ children }) => <>{children}</> }));

function reduceMotion(on) {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: on && query === "(prefers-reduced-motion: reduce)", media: query, addEventListener: jest.fn(), removeEventListener: jest.fn(),
  }));
}
const tick = (seconds) => act(() => { jest.advanceTimersByTime(seconds * 1000); });
const liveStep = (container) => container.querySelector(".breathing__step");

beforeEach(() => {
  mockQuery = {};
  mockReplace.mockClear();
  reduceMotion(false);
});
afterEach(() => jest.useRealTimers());

describe("breathing timing", () => {
  test("in 4 s, hold 4 s, out 6 s, nine rounds: 126 s, about two minutes", () => {
    expect(BREATHING_PHASES.map(({ label, seconds }) => [label, seconds])).toEqual([["Breathe in", 4], ["Hold", 4], ["Breathe out", 6]]);
    expect(BREATHING_ROUNDS).toBe(9);
    expect(BREATHING_TOTAL_SECONDS).toBe(126);
  });

  test.each([
    [0, "Breathe in", 4, 1], [3, "Breathe in", 1, 1], [4, "Hold", 4, 1], [7, "Hold", 1, 1],
    [8, "Breathe out", 6, 1], [13, "Breathe out", 1, 1], [14, "Breathe in", 4, 2], [125, "Breathe out", 1, 9],
  ])("after %i s: %s, %i s left, round %i", (elapsed, label, secondsLeft, round) => {
    expect(breathingStateAt(elapsed)).toMatchObject({ done: false, secondsLeft, round, phase: expect.objectContaining({ label }) });
  });

  test("finishes at 126 s", () => {
    expect(breathingStateAt(126)).toMatchObject({ done: true, remaining: 0 });
    expect(breathingStateAt(500).done).toBe(true);
  });

  test("the steps change on time, each is announced once, and the countdown is hidden from screen readers", () => {
    jest.useFakeTimers();
    const { container } = render(<BreathingExercise />);
    expect(liveStep(container)).toHaveAttribute("aria-live", "polite");
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(liveStep(container)).toHaveTextContent("Breathe in");
    expect(container.querySelector(".held--breathe.held--phase-in")).not.toBeNull();
    const node = liveStep(container).firstChild;
    tick(1);
    // Within a step only the hidden countdown changes; the live text stays the very same node.
    expect(liveStep(container).firstChild).toBe(node);
    expect(container.querySelector(".breathing__count")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".breathing__seconds")).toHaveTextContent("3");
    tick(3);
    expect(liveStep(container)).toHaveTextContent("Hold");
    tick(4);
    expect(liveStep(container)).toHaveTextContent("Breathe out");
    expect(container.querySelector(".held--breathe.held--phase-out")).not.toBeNull();
  });

  test("Pause stops the clock, Resume carries on, Stop goes back to the start; focus stays on the one button", () => {
    jest.useFakeTimers();
    const { container } = render(<BreathingExercise />);
    const button = screen.getByRole("button", { name: "Start" });
    button.focus();
    fireEvent.click(button);
    tick(5);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Resume" })).toBe(button);
    expect(button).toHaveFocus();
    expect(liveStep(container)).toHaveTextContent("Paused");
    tick(30);
    fireEvent.click(button);
    expect(liveStep(container)).toHaveTextContent("Hold");
    expect(container.querySelector(".breathing__seconds")).toHaveTextContent("3");
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(screen.getByRole("button", { name: "Start" })).toBe(button);
    expect(liveStep(container)).toHaveTextContent("");
  });

  test("calls onComplete once after about two minutes and says so", () => {
    jest.useFakeTimers();
    const done = jest.fn();
    render(<BreathingExercise onComplete={done} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    tick(125);
    expect(done).not.toHaveBeenCalled();
    tick(1);
    expect(done).toHaveBeenCalledTimes(1);
    tick(10);
    expect(done).toHaveBeenCalledTimes(1);
  });

  test("with reduce motion: no moving mark, just the text steps with their countdown", () => {
    reduceMotion(true);
    jest.useFakeTimers();
    const { container } = render(<BreathingExercise />);
    expect(screen.getByText(/breathe in for 4 seconds, hold for 4, and breathe out for 6/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(container.querySelector(".held")).toBeNull();
    expect(container.querySelector(".breathing--still")).not.toBeNull();
    expect(liveStep(container)).toHaveTextContent("Breathe in");
    expect(container.querySelector(".breathing__seconds")).toHaveTextContent("4");
    tick(4);
    expect(liveStep(container)).toHaveTextContent("Hold");
  });
});

describe("grounding and wind-down", () => {
  test("one step at a time with Back and Next, no text input", () => {
    const { container } = render(<GroundingExercise />);
    expect(GROUNDING_STEPS.map((step) => step.count)).toEqual([5, 4, 3, 2, 1]);
    expect(screen.getByText("Name 5 things you can see.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Name 4 things you can feel.")).toBeInTheDocument();
    expect(container.querySelector(".grounding__step")).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Name 5 things you can see.")).toBeInTheDocument();
    for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Name 1 thing you can taste.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.getByText(/You've finished the grounding exercise/)).toHaveFocus();
    expect(container.querySelector("input, textarea")).toBeNull();
  });

  test("the wind-down ticks stay on screen only and point to the sleep log", () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem");
    render(<WindDown />);
    const box = screen.getByRole("checkbox", { name: "Dim the lights." });
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(setItem).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Log your sleep tomorrow morning" })).toHaveAttribute("href", "/water-and-sleep#sleep-heading");
    setItem.mockRestore();
  });
});

describe("5-minute reset", () => {
  test("breathing, then grounding, then the reflection question, in order", () => {
    expect(RESET_STEPS.map((step) => step.key)).toEqual(["breathing", "grounding", "reflection"]);
    expect(nextResetStep("breathing")).toBe("grounding");
    expect(nextResetStep("grounding")).toBe("reflection");
    expect(nextResetStep("reflection")).toBeNull();

    jest.useFakeTimers();
    render(<ResetExercise onStop={jest.fn()} />);
    const current = () => screen.getByRole("list", { name: "5-minute reset progress" }).querySelector('[aria-current="step"]');
    expect(current()).toHaveTextContent("Breathing");
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    tick(BREATHING_TOTAL_SECONDS);
    expect(current()).toHaveTextContent("Grounding");
    expect(screen.getByRole("heading", { name: "Step 2 of 3: Grounding" })).toHaveFocus();
    for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(current()).toHaveTextContent("Reflection");
    expect(screen.getByText(reflectionQuestionFor())).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.getByText(/You've finished the 5-minute reset/)).toHaveFocus();
  });

  test.each(["breathing", "grounding", "reflection"])("can be stopped during %s", (step) => {
    jest.useFakeTimers();
    const stop = jest.fn();
    render(<ResetExercise onStop={stop} />);
    if (step !== "breathing") { fireEvent.click(screen.getByRole("button", { name: "Start" })); tick(BREATHING_TOTAL_SECONDS); }
    if (step === "reflection") { for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getByRole("button", { name: "Next" })); fireEvent.click(screen.getByRole("button", { name: "Finish" })); }
    fireEvent.click(screen.getByRole("button", { name: "Stop the reset" }));
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe("question of the day", () => {
  test("a fixed list of 30 short questions", () => {
    expect(REFLECTION_QUESTIONS).toHaveLength(30);
    expect(new Set(REFLECTION_QUESTIONS).size).toBe(30);
    expect(REFLECTION_QUESTIONS).toContain("What's one small thing that went well today?");
  });

  test("changes at midnight in Beirut, not at UTC or device midnight", () => {
    // November: Beirut is UTC+2, so midnight in Beirut is 22:00 UTC.
    const before = new Date("2026-11-15T21:59:59Z");
    const after = new Date("2026-11-15T22:00:00Z");
    expect(beirutDayNumber(after)).toBe(beirutDayNumber(before) + 1);
    expect(reflectionQuestionFor(after)).not.toBe(reflectionQuestionFor(before));
    expect(reflectionQuestionFor(new Date("2026-11-15T23:59:00Z"))).toBe(reflectionQuestionFor(after));
    // Summer: UTC+3, midnight in Beirut is 21:00 UTC.
    expect(beirutDayNumber(new Date("2026-07-01T21:00:00Z"))).toBe(beirutDayNumber(new Date("2026-07-01T20:59:59Z")) + 1);
  });

  test("goes through every question before repeating", () => {
    const start = new Date("2026-11-15T10:00:00Z").getTime();
    const seen = Array.from({ length: 30 }, (_, day) => reflectionQuestionFor(new Date(start + day * 86400000)));
    expect(new Set(seen).size).toBe(30);
    expect(reflectionQuestionFor(new Date(start + 30 * 86400000))).toBe(seen[0]);
  });
});

describe("140 and 1564 are always shown", () => {
  const expectHelp = (scope) => {
    expect(within(scope).getByText(HELP_SENTENCE)).toBeInTheDocument();
    expect(within(scope).getByRole("link", { name: "Call 140" })).toHaveAttribute("href", "tel:140");
    expect(within(scope).getByRole("link", { name: "Call 1564" })).toHaveAttribute("href", "tel:1564");
    expect(within(scope).getByRole("heading", { name: "When to reach out" })).toBeInTheDocument();
    expect(within(scope).getByRole("link", { name: "Embrace's official website" })).toHaveAttribute("href", "https://embracelebanon.org/");
  };

  test("on the page before any exercise is opened", () => {
    render(<WellbeingPage />);
    expectHelp(document.body);
    expect(screen.getAllByRole("link", { name: "Call 140" })).toHaveLength(1);
  });

  test.each(EXERCISES.map((exercise) => [exercise.title, exercise.key]))("with the %s, from start to end", (title, key) => {
    jest.useFakeTimers();
    mockQuery = { start: key };
    render(<WellbeingPage />);
    const panel = document.getElementById(`exercise-${key}`);
    expect(within(panel).getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    expectHelp(panel);
    // Once per page: the page's own support card hides while the panel shows it.
    expect(screen.getAllByRole("link", { name: "Call 140" })).toHaveLength(1);
    if (key === "breathing" || key === "reset") {
      fireEvent.click(within(panel).getByRole("button", { name: "Start" }));
      expectHelp(panel);
      tick(BREATHING_TOTAL_SECONDS);
    }
    if (key === "grounding" || key === "reset") {
      for (let i = 0; i < 4; i += 1) fireEvent.click(within(panel).getByRole("button", { name: "Next" }));
      fireEvent.click(within(panel).getByRole("button", { name: "Finish" }));
    }
    if (key === "reset") fireEvent.click(within(panel).getByRole("button", { name: "Finish" }));
    expect(within(panel).queryByText(/You've finished|Log your sleep/)).toBeInTheDocument();
    expectHelp(panel);
  });

  test("closing the panel brings back the page's support card", () => {
    mockQuery = { start: "grounding" };
    render(<WellbeingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(document.getElementById("exercise-grounding")).toBeNull();
    expectHelp(document.body);
    expect(mockReplace).toHaveBeenCalledWith("/wellbeing", undefined, { shallow: true });
  });
});

describe("where the exercises appear", () => {
  test("the Wellbeing Corner shows the question of the day next to Today's message and the four exercise buttons", () => {
    render(<WellbeingCorner />);
    expect(screen.getByRole("heading", { name: "Question of the day" })).toBeInTheDocument();
    expect(screen.getByText(reflectionQuestionFor())).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Breathing exercise" })).toHaveAttribute("href", "/wellbeing?start=breathing");
    expect(screen.getByRole("link", { name: "Grounding exercise" })).toHaveAttribute("href", "/wellbeing?start=grounding");
    expect(screen.getByRole("link", { name: "5-minute reset" })).toHaveAttribute("href", "/wellbeing?start=reset");
    expect(screen.getByRole("link", { name: "Bedtime wind-down" })).toHaveAttribute("href", "/wellbeing?start=wind-down");
    // The support numbers come first, so someone sent here for support sees them before the exercises.
    const support = screen.getByRole("heading", { name: "Support in Lebanon" });
    const exercises = screen.getByRole("heading", { name: "Calm exercises" });
    expect(support.compareDocumentPosition(exercises) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test.each(["urgent", "emergency"])("never on an %s symptom result, including the self-harm one", (level) => {
    render(<UrgencyResult result={{ level, label: level === "urgent" ? "Urgent" : "Emergency", timeframe: "Now", action: "Get help now.", reasons: [], matchedRuleIds: ["self-harm"] }} />);
    for (const name of [/Breathing exercise/, /Grounding exercise/, /5-minute reset/, /Bedtime wind-down/, /Question of the day/]) {
      expect(screen.queryByText(name)).toBeNull();
    }
    expect(document.querySelector('a[href^="/wellbeing"]')).toBeNull();
  });
});
