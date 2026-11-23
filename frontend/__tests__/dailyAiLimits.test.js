// Per-account daily AI limits (backend dailyAiLimits.js): the usage lines, the friendly notice at a limit, and the
// symptom check's rules-only note. Emergencies are never limited, so they never show either.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SymptomsPage from "../pages/symptoms";
import HealthAssistantPage from "../pages/health-assistant";
import MyHistoryPage from "../pages/my-history";
import PrescriptionScan from "../components/PrescriptionScan";
import { AiUsageLine, DailyLimitNotice } from "../components/AiUsage";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { assessUrgency } from "../lib/triageApi";
import { addSymptomRecord } from "../lib/symptomApi";
import { getEmergencyContact, request } from "../lib/api";
import { askHistory, getHealthStory } from "../lib/historyApi";
import { readPrescription } from "../lib/prescriptionApi";
import { getAiUsage, dailyLimitOf } from "../lib/aiUsageApi";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

jest.setTimeout(PAGE_FLOW_TIMEOUT);

jest.mock("../components/ProfileHeader", () => () => <div />);
jest.mock("../context/ActiveProfileContext", () => ({ useActiveProfile: jest.fn() }));
jest.mock("../lib/symptomApi", () => ({
  addSymptomRecord: jest.fn(),
  getSymptomsForProfile: jest.fn().mockResolvedValue([]),
  updateSymptomRecord: jest.fn(),
}));
jest.mock("../lib/triageApi", () => ({ assessUrgency: jest.fn(), assessUrgencyWithAnswers: jest.fn(), newCheckId: () => "check-test" }));
jest.mock("../lib/api", () => ({ ...jest.requireActual("../lib/api"), request: jest.fn(), getEmergencyContact: jest.fn() }));
jest.mock("../lib/reportConversationApi", () => ({ getReportConversations: jest.fn().mockResolvedValue({ conversations: [] }), deleteReportConversation: jest.fn() }));
jest.mock("../lib/historyApi", () => ({ askHistory: jest.fn(), getHealthStory: jest.fn() }));
jest.mock("../lib/visitPrepApi", () => ({ addDoctorQuestion: jest.fn() }));
jest.mock("../lib/prescriptionApi", () => ({ ...jest.requireActual("../lib/prescriptionApi"), readPrescription: jest.fn() }));

const RESETS_AT = new Date(Date.now() + 5 * 3600000).toISOString();
const usage = (feature, used, limit) => ({ feature, used, limit, remaining: Math.max(limit - used, 0), resetsAt: RESETS_AT });
const allUsage = (overrides = {}) => ({
  timeZone: "Asia/Beirut", resetsAt: RESETS_AT,
  symptomChecks: usage("symptomChecks", 0, 20), assistantMessages: usage("assistantMessages", 0, 40),
  historyQuestions: usage("historyQuestions", 0, 30), prescriptionReads: usage("prescriptionReads", 0, 10),
  reportAnalyses: usage("reportAnalyses", 0, 5), ...overrides,
});
// The error lib/api.js throws for a 429 daily limit.
const limitError = (message, dailyLimit) => Object.assign(new Error(message), { status: 429, code: "daily_ai_limit", dailyLimit });

const ROUTINE = {
  level: "routine", label: "Routine / self-care", timeframe: "Within a few days, if it does not improve",
  action: "Rest and monitor your symptoms.", reasons: ["Mild, common symptoms like these can usually be managed at home."],
  disclaimer: "This is guidance, not a diagnosis. If you think it is an emergency, call 140 now.",
};
const RULES_NOTE = "You've used today's AI checks; this result uses Nabad's safety rules only. The AI part comes back tomorrow.";

beforeEach(() => {
  jest.clearAllMocks();
  useActiveProfile.mockReturnValue({ activeProfile: { id: "self", fullName: "Rana", isSelf: true }, error: "" });
  getAiUsage.mockResolvedValue(allUsage());
  getEmergencyContact.mockResolvedValue({ contact: null });
  addSymptomRecord.mockResolvedValue({ id: "symptom-1" });
  getHealthStory.mockResolvedValue({ from: "2026-06", until: "2026-11", months: [], counts: {}, hasEarlier: false, earlierUntil: null, truncated: false });
});

describe("the usage line and notice", () => {
  test("the line says how many are used today, and can wait until a number is reached", () => {
    const { rerender } = render(<AiUsageLine usage={usage("assistantMessages", 15, 40)} noun="messages" />);
    expect(screen.getByText("15 of 40 messages used today")).toBeInTheDocument();
    rerender(<AiUsageLine usage={usage("symptomChecks", 14, 20)} noun="AI checks" showFrom={15} />);
    expect(screen.queryByTestId("ai-usage-line")).not.toBeInTheDocument();
    rerender(<AiUsageLine usage={null} noun="AI checks" />);
    expect(screen.queryByTestId("ai-usage-line")).not.toBeInTheDocument();
  });

  test("the notice is calm (a status, not an alert) and says when it starts again", () => {
    render(<DailyLimitNotice limit={usage("reportAnalyses", 5, 5)} message="You've used today's 5 lab report reviews. They start again at midnight, Beirut time." />);
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("You've reached today's limit");
    expect(notice).toHaveTextContent("They start again at midnight, Beirut time.");
    expect(notice).toHaveTextContent("That's in about 5 hours.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("only a daily-limit error is treated as one", () => {
    expect(dailyLimitOf(limitError("x", usage("assistantMessages", 40, 40)))).toEqual(usage("assistantMessages", 40, 40));
    expect(dailyLimitOf(Object.assign(new Error("Too many"), { status: 429 }))).toBeNull();
  });
});

describe("symptom check", () => {
  async function check(user) {
    render(<SymptomsPage />);
    await user.type(screen.getByLabelText("Symptoms"), "a mild headache");
    await user.click(screen.getByRole("button", { name: "Submit symptoms" }));
  }

  test("normal: no usage line while under 15 of 20", async () => {
    const user = userEvent.setup({ delay: null });
    getAiUsage.mockResolvedValue(allUsage({ symptomChecks: usage("symptomChecks", 3, 20) }));
    assessUrgency.mockResolvedValue({ ...ROUTINE, aiUsage: usage("symptomChecks", 4, 20) });
    await check(user);
    expect(await screen.findByText("Routine / self-care")).toBeInTheDocument();
    expect(screen.queryByTestId("ai-usage-line")).not.toBeInTheDocument();
    expect(screen.queryByText(RULES_NOTE)).not.toBeInTheDocument();
  });

  test("near the limit: the line shows from 15 of 20", async () => {
    const user = userEvent.setup({ delay: null });
    getAiUsage.mockResolvedValue(allUsage({ symptomChecks: usage("symptomChecks", 14, 20) }));
    assessUrgency.mockResolvedValue({ ...ROUTINE, aiUsage: usage("symptomChecks", 15, 20) });
    render(<SymptomsPage />);
    await waitFor(() => expect(getAiUsage).toHaveBeenCalled());
    expect(screen.queryByTestId("ai-usage-line")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Symptoms"), "a mild headache");
    await user.click(screen.getByRole("button", { name: "Submit symptoms" }));
    expect(await screen.findByText("15 of 20 AI checks used today")).toBeInTheDocument();
  });

  test("at the limit: the rules result shows with one calm line, directly above the urgency box", async () => {
    const user = userEvent.setup({ delay: null });
    assessUrgency.mockResolvedValue({
      ...ROUTINE, ai: { used: false, reason: "daily_limit" }, aiUsage: usage("symptomChecks", 20, 20),
      dailyLimit: { reached: true, message: RULES_NOTE },
    });
    await check(user);
    expect(await screen.findByText("Routine / self-care")).toBeInTheDocument();
    const note = screen.getByText(RULES_NOTE);
    expect(note).toHaveAttribute("role", "status");
    // Read first: the note is the element right before the result, so it is seen before the urgency.
    const result = document.getElementById("symptom-result");
    expect(note.nextElementSibling).toBe(result);
    expect(note.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("20 of 20 AI checks used today")).toBeInTheDocument();
  });
});

describe("health assistant", () => {
  test("shows today's messages under the box, and a friendly notice at the limit with the question kept", async () => {
    const user = userEvent.setup({ delay: null });
    getAiUsage.mockResolvedValue(allUsage({ assistantMessages: usage("assistantMessages", 15, 40) }));
    render(<HealthAssistantPage />);
    expect(await screen.findByText("15 of 40 messages used today")).toBeInTheDocument();

    request.mockRejectedValueOnce(limitError("You've used today's 40 health assistant messages. They start again at midnight, Beirut time.", usage("assistantMessages", 40, 40)));
    await user.type(screen.getByLabelText("Your message"), "What does hemoglobin do?");
    await user.click(screen.getByRole("checkbox", { name: /I agree to send my question/ }));
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("You've reached today's limit")).toBeInTheDocument();
    expect(screen.getByText(/They start again at midnight, Beirut time\./)).toBeInTheDocument();
    expect(screen.getByText("If this is an emergency, call 140 now.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("40 of 40 messages used today")).toBeInTheDocument();
    expect(screen.getByLabelText("Your message")).toHaveValue("What does hemoglobin do?");
  });

  test("the line follows each answer", async () => {
    const user = userEvent.setup({ delay: null });
    getAiUsage.mockResolvedValue(allUsage({ assistantMessages: usage("assistantMessages", 2, 40) }));
    render(<HealthAssistantPage />);
    expect(await screen.findByText("2 of 40 messages used today")).toBeInTheDocument();
    request.mockResolvedValueOnce({ answer: "It carries oxygen.", evidence: [], citations: [], disclaimer: "", conversationId: "c1", aiUsage: usage("assistantMessages", 3, 40) });
    await user.type(screen.getByLabelText("Your message"), "What does hemoglobin do?");
    await user.click(screen.getByRole("checkbox", { name: /I agree to send my question/ }));
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("3 of 40 messages used today")).toBeInTheDocument();
  });
});

describe("ask about my history", () => {
  test("at the limit: a friendly notice that says it still works without AI", async () => {
    const user = userEvent.setup({ delay: null });
    askHistory.mockRejectedValueOnce(limitError("You've used today's 30 AI questions about your history. They start again at midnight, Beirut time.", usage("historyQuestions", 30, 30)));
    render(<MyHistoryPage />);
    await user.click(screen.getByRole("checkbox", { name: /Let AI write the answer/ }));
    expect(await screen.findByText("0 of 30 AI questions used today")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Your question"), "When did I last have a headache?");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText(/You've used today's 30 AI questions about your history/)).toBeInTheDocument();
    expect(screen.getByText(/You can still ask now without AI/)).toBeInTheDocument();
    expect(screen.getByText("30 of 30 AI questions used today")).toBeInTheDocument();
  });
});

describe("prescription photo", () => {
  test("at the limit: a friendly notice, and the person can add medicines by hand", async () => {
    const user = userEvent.setup({ delay: null });
    readPrescription.mockRejectedValueOnce(limitError("You've used today's 10 prescription photo readings. They start again at midnight, Beirut time.", usage("prescriptionReads", 10, 10)));
    render(<PrescriptionScan profileId="self" listName="your list" onDone={jest.fn()} onCancel={jest.fn()} />);
    expect(await screen.findByText("0 of 10 prescription readings used today")).toBeInTheDocument();
    await user.upload(screen.getByLabelText("Prescription photo or PDF"), new File([new Uint8Array([137, 80, 78, 71])], "rx.png", { type: "image/png" }));
    await user.click(screen.getByRole("checkbox", { name: /I agree to send this prescription/ }));
    await user.click(screen.getByRole("button", { name: "Read prescription" }));
    expect(await screen.findByText(/You've used today's 10 prescription photo readings/)).toBeInTheDocument();
    expect(screen.getByText("You can still add your medicines by hand.")).toBeInTheDocument();
    expect(screen.getByText("10 of 10 prescription readings used today")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
