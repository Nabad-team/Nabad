// SCRUM-130 (backlog #29): "As a user, I want a plain-language explanation of why a recommendation
// was given so that I trust the result."
import { render, screen, within } from "@testing-library/react";
import UrgencyResult from "../components/UrgencyResult";
import { useAccessibility } from "../context/AccessibilityContext";

jest.mock("../context/AccessibilityContext", () => ({ useAccessibility: jest.fn() }));
// Shows the text that would be read aloud, so the test can check it.
jest.mock("../components/ReadAloudButton", () => ({
  __esModule: true,
  default: ({ text }) => <span data-testid="read-aloud">{text}</span>,
}));

const DISCLAIMER = "This is guidance, not a diagnosis. If you think it is an emergency, call 140 now.";
const CALL_140 = "Call 140 straight away if you get chest pain, trouble breathing, a drooping face or slurred speech, a seizure, or bleeding that won't stop.";

const URGENT_RESULT = {
  level: "urgent",
  label: "Urgent",
  timeframe: "Within a few hours (today)",
  action: "Get seen today at an emergency department or urgent care clinic. Call 140 if it gets worse.",
  reasons: ["A temperature of 39.5°C or higher should be checked today."],
  confidence: "refined",
  disclaimer: DISCLAIMER,
  explanation: {
    summary: "We suggest getting seen by a doctor today because of your answer “39.5°C or higher”.",
    triggers: [{ words: ["fever"], meaning: "A fever should be checked by a doctor if it lasts or gets worse." }],
    changedBy: [{
      question: "What is the highest temperature you measured?",
      answer: "39.5°C or higher",
      effect: "A temperature of 39.5°C or higher should be checked today.",
    }],
    notCounted: ["chest pain", "trouble breathing"],
    watchFor: [CALL_140, "If you can't be seen by a doctor today, go to an emergency department."],
    basedOn: "Nabad's safety rules, which look for known warning signs in what you wrote, and your answers to the follow-up questions.",
  },
};

const EMERGENCY_RESULT = {
  level: "emergency",
  label: "Emergency",
  timeframe: "Now",
  action: "Call 140 (Lebanese Red Cross) or go to the nearest emergency department immediately.",
  reasons: ["Chest pain or pressure can be a sign of a heart attack."],
  disclaimer: DISCLAIMER,
  explanation: {
    summary: "We suggest getting emergency care now because you mentioned “chest pain”.",
    triggers: [{ words: ["chest pain"], meaning: "Chest pain or pressure can be a sign of a heart attack." }],
    changedBy: [],
    notCounted: [],
    watchFor: ["Don't wait to see if it gets better. Call 140 or go to the nearest emergency department now."],
    basedOn: "Nabad's safety rules, which look for known warning signs in what you wrote.",
  },
};

const setSimplified = (simplifiedMode) => useAccessibility.mockReturnValue({ preferences: { simplifiedMode } });
const explanationBox = () => screen.getByRole("heading", { name: "Why we suggest this" }).closest(".urgency__explanation");

beforeEach(() => setSimplified(false));

describe("UrgencyResult explanation", () => {
  test("shows a 'Why we suggest this' section with the one-sentence summary", () => {
    render(<UrgencyResult result={URGENT_RESULT} />);
    expect(screen.getByRole("heading", { name: "Why we suggest this" })).toBeInTheDocument();
    expect(screen.getByText(URGENT_RESULT.explanation.summary)).toBeInTheDocument();
  });

  test("lists what the user told us and what it can mean", () => {
    render(<UrgencyResult result={URGENT_RESULT} />);
    expect(screen.getByText("What you told us:")).toBeInTheDocument();
    expect(screen.getByText("“fever”: A fever should be checked by a doctor if it lasts or gets worse.")).toBeInTheDocument();
  });

  test("lists the answers that made it more urgent", () => {
    render(<UrgencyResult result={URGENT_RESULT} />);
    expect(screen.getByText("Your answers that made it more urgent:")).toBeInTheDocument();
    const item = screen.getByText(/What is the highest temperature you measured\?/).closest("li");
    expect(item).toHaveTextContent("You answered “39.5°C or higher”. A temperature of 39.5°C or higher should be checked today.");
  });

  test("says which warning signs were not counted, so the user can correct a misreading", () => {
    render(<UrgencyResult result={URGENT_RESULT} />);
    expect(screen.getByText(/you said you don't have “chest pain” and “trouble breathing”, so they were not counted/)).toBeInTheDocument();
    expect(screen.getByText(/If that's wrong, describe your symptoms again/)).toBeInTheDocument();
  });

  test("says when to get help sooner", () => {
    render(<UrgencyResult result={URGENT_RESULT} />);
    expect(screen.getByText("Get help sooner if things change:")).toBeInTheDocument();
    expect(screen.getByText(CALL_140)).toBeInTheDocument();
  });

  test("says what the result was based on", () => {
    render(<UrgencyResult result={URGENT_RESULT} />);
    expect(screen.getByText(/^Based on Nabad's safety rules/)).toBeInTheDocument();
  });

  test("does not repeat the old 'Why:' list when an explanation is shown", () => {
    render(<UrgencyResult result={URGENT_RESULT} />);
    expect(screen.queryByText("Why:")).not.toBeInTheDocument();
  });

  test("an emergency shows 'don't wait' as one strong line, not a 'get help sooner' list", () => {
    render(<UrgencyResult result={EMERGENCY_RESULT} />);
    const box = explanationBox();
    expect(within(box).getByText(/Don't wait to see if it gets better/).tagName).toBe("STRONG");
    expect(screen.queryByText("Get help sooner if things change:")).not.toBeInTheDocument();
    expect(screen.queryByText(/Not counted/)).not.toBeInTheDocument();
  });

  test("simplified mode keeps only the summary and the safety advice", () => {
    setSimplified(true);
    render(<UrgencyResult result={URGENT_RESULT} />);
    expect(screen.getByText(URGENT_RESULT.explanation.summary)).toBeInTheDocument();
    expect(screen.getByText(CALL_140)).toBeInTheDocument();
    for (const hidden of ["What you told us:", "Your answers that made it more urgent:", /Not counted/, /^Based on/]) {
      expect(screen.queryByText(hidden)).not.toBeInTheDocument();
    }
  });

  test("read aloud says the summary and the safety advice instead of the old reasons", () => {
    render(<UrgencyResult result={URGENT_RESULT} />);
    const spoken = screen.getByTestId("read-aloud").textContent;
    expect(spoken).toContain(URGENT_RESULT.explanation.summary);
    expect(spoken).toContain(CALL_140);
    expect(spoken).not.toContain("Why:");
  });

  test("with an AI check, its own notes are shown too", () => {
    const result = { ...URGENT_RESULT, ai: { used: true, level: "urgent", guardrails: ["model_raised"] }, reasons: ["Trouble swallowing saliva should be checked today."] };
    render(<UrgencyResult result={result} />);
    expect(screen.getByText("What the AI check noted:")).toBeInTheDocument();
    expect(screen.getByText("Trouble swallowing saliva should be checked today.")).toBeInTheDocument();
  });

  test("an older response without an explanation still shows the reasons", () => {
    const { explanation, ...older } = URGENT_RESULT;
    render(<UrgencyResult result={older} />);
    expect(screen.getByText("Why:")).toBeInTheDocument();
    expect(screen.getByText("A temperature of 39.5°C or higher should be checked today.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Why we suggest this" })).not.toBeInTheDocument();
  });

  test("text that looks like HTML is shown as text, never run", () => {
    const result = { ...URGENT_RESULT, explanation: { ...URGENT_RESULT.explanation, summary: "<img src=x onerror=alert(1)>" } };
    const { container } = render(<UrgencyResult result={result} />);
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
