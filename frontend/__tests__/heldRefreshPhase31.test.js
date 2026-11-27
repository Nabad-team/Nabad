// Held refresh, phase 3.1, updated for the guided symptom check: the follow-up questions are no longer inside the
// result (the page asks them first, then shows the result). The result is organised as header, red flags, one card
// of detail rows ("Why we suggest this", "Your answers", ...), then the actions. (The phone 140 button is in
// AppHeader.test.js, the Filters button in providers.test.js, the tile grid and the setup ring in dashboard.test.js
// and gettingStarted.test.js.)
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
const ANSWERS = [{ question: "How high is the fever?", answer: "39.5°C or higher" }];
const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

beforeEach(() => useAccessibility.mockReturnValue({ preferences: { simplifiedMode: false } }));

test("header, then the red flags, then the detail rows with Your answers, then the actions", () => {
  render(<UrgencyResult result={SOON} answers={ANSWERS} />);
  const header = document.querySelector(".urgency__indicator");
  const watch = document.querySelector(".urgency__watch");
  const why = screen.getByRole("heading", { name: "Why we suggest this" });
  const answers = screen.getByRole("heading", { name: "Your answers" });
  const actions = document.querySelector(".urgency__actions");
  expect(follows(header, watch)).toBe(true);
  expect(follows(watch, why)).toBe(true);
  expect(follows(why, answers)).toBe(true);
  expect(follows(answers, actions)).toBe(true);
  expect(document.querySelector(".urgency__answers")).toHaveTextContent("How high is the fever?39.5°C or higher");
  // The red flags stay visible, outside every disclosure.
  expect(watch.closest("details")).toBeNull();
  expect(screen.getByText(CALL_140)).toBeVisible();
});

test("without answers there is no Your answers row, and no question text inside the result", () => {
  render(<UrgencyResult result={SOON} />);
  expect(screen.queryByRole("heading", { name: "Your answers" })).toBeNull();
  expect(screen.queryByText(/Answer the questions below/)).toBeNull();
});
