import { fireEvent, render, screen } from "@testing-library/react";
import TestResultsPage from "../pages/test-results";
import { getReportConversations } from "../lib/reportConversationApi";
import { request } from "../lib/api";

jest.mock("../components/ProfileHeader", () => () => <div />);
jest.mock("../context/ActiveProfileContext", () => ({
  useActiveProfile: () => ({ activeProfile: { id: "self", fullName: "Maya" } }),
}));
jest.mock("../lib/api", () => ({ request: jest.fn() }));
jest.mock("../lib/reportConversationApi", () => ({
  getReportConversations: jest.fn(),
  deleteReportConversation: jest.fn(),
}));

const savedConversation = {
  id: "conversation-1",
  title: "What does this report mean?",
  updatedAt: "2026-10-18T09:00:00.000Z",
  messages: [
    { role: "user", content: "What does this report mean?" },
    { role: "assistant", content: "The report lists a result for review." },
  ],
  reportResult: {
    urgency: "routine",
    summary: "The report includes one finding.",
    findings: [{ name: "Test value", sourceQuote: "Value 1", result: "1", explanation: "A reported finding.", followUp: "Ask your clinician." }],
    nextStep: "Review it with your clinician.",
    uncertainties: [],
    disclaimer: "AI information is not a diagnosis.",
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  getReportConversations.mockResolvedValue({ conversations: [savedConversation] });
});

test("loads saved chats for review and prints the report explanation as PDF", async () => {
  const print = jest.fn();
  window.print = print;
  render(<TestResultsPage />);
  fireEvent.click(await screen.findByRole("button", { name: savedConversation.title }));

  expect(await screen.findByText("The report includes one finding.")).toBeInTheDocument();
  expect(screen.getByText("The report lists a result for review.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Print or save as PDF" }));
  expect(print).toHaveBeenCalledTimes(1);
});

test("sends a follow-up in the selected saved conversation and displays its answer", async () => {
  request.mockResolvedValue({
    answer: "Here is the follow-up answer.",
    evidence: [],
    disclaimer: "AI information is not a diagnosis.",
    conversationId: savedConversation.id,
  });
  render(<TestResultsPage />);
  fireEvent.click(await screen.findByRole("button", { name: savedConversation.title }));
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "Can you explain that further?" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));

  expect(await screen.findByText("Here is the follow-up answer.")).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith("/reports/chat?profileId=self", expect.objectContaining({
    method: "POST",
    body: expect.stringContaining(`"conversationId":"${savedConversation.id}"`),
  }));
});
