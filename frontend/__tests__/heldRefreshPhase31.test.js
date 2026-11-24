// Held refresh, phase 3.1: the result's follow-up questions sit right after the red flags, before "Why we suggest
// this" and the actions. (The phone 140 button is in AppHeader.test.js, the Filters button in providers.test.js, the
// tile grid and the setup ring in dashboard.test.js and gettingStarted.test.js.)
import { render, screen } from "@testing-library/react";
import UrgencyResult from "../components/UrgencyResult";
import { useAccessibility } from "../context/AccessibilityContext";

jest.mock("../context/AccessibilityContext", () => ({ useAccessibility: jest.fn() }));

const CALL_140 = "Call 140 straight away if you get chest pain or trouble breathing.";
const SOON = {
  level: "soon", label: "See a doctor soon", timeframe: "Within 24 to 48 hours", action: "Book an appointment.",
  reasons: [], disclaimer: "This is guidance, not a diagnosis.", selfCareGuidance: ["Rest."],
  explanation: { summary: "We suggest seeing a doctor soon.", watchFor: [CALL_140] },
};
const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

beforeEach(() => useAccessibility.mockReturnValue({ preferences: { simplifiedMode: false } }));

test("with follow-up questions: red flags, then the intro line, then the questions, then Why and the actions", () => {
  render(<UrgencyResult result={SOON} preliminary followUps={<section aria-label="A quick question"><p>How high is the fever?</p></section>} />);
  const watch = document.querySelector(".urgency__watch");
  const intro = screen.getByText("Answer the questions below to make this more accurate.");
  const questions = screen.getByRole("region", { name: "A quick question" });
  const why = screen.getByRole("heading", { name: "Why we suggest this" });
  const actions = document.querySelector(".urgency__actions");
  expect(follows(watch, intro)).toBe(true);
  expect(follows(intro, questions)).toBe(true);
  expect(intro.nextElementSibling).toBe(questions);
  expect(follows(questions, why)).toBe(true);
  expect(follows(questions, actions)).toBe(true);
  // The red flags stay visible, outside every disclosure.
  expect(watch.closest("details")).toBeNull();
  expect(screen.getByText(CALL_140)).toBeVisible();
});

test("without questions there is no intro line, and the slot adds nothing", () => {
  render(<UrgencyResult result={SOON} followUps={null} />);
  expect(screen.queryByText(/Answer the questions below/)).toBeNull();
});
