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
    findings: [{ name: "Test value", category: "abnormal", sourceQuote: "Value 1", result: "1", explanation: "A reported finding.", followUp: "Ask your clinician." }],
    nextStep: "Review it with your clinician.",
    uncertainties: [],
    reportCoverage: "complete_text",
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
  expect(screen.getByRole("heading", { name: "Abnormal findings" })).toBeInTheDocument();
  expect(screen.queryByText("The report lists a result for review.")).not.toBeInTheDocument();
  expect(screen.getByText("The readable text of the uploaded report was processed.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Print or save as PDF" }));
  expect(print).toHaveBeenCalledTimes(1);
});

test("shows page-level coverage when PDF extraction is incomplete", async () => {
  getReportConversations.mockResolvedValueOnce({ conversations: [{
    ...savedConversation,
    id: "partial-conversation",
    title: "Partial report",
    reportResult: {
      ...savedConversation.reportResult,
      reportCoverage: "partial_text",
      extractionCoverage: { pageCount: 3, readablePages: 1, sparsePages: [3], unreadablePages: [2], status: "uncertain" },
    },
  }] });
  render(<TestResultsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Partial report" }));
  expect(await screen.findByRole("status")).toHaveTextContent("1 readable of 3 PDF pages");
  expect(screen.getByRole("status")).toHaveTextContent("unreadable pages: 2");
  expect(screen.getByRole("status")).toHaveTextContent("low-text pages: 3");
});

test("shows server-validated RAG source version and review date", async () => {
  getReportConversations.mockResolvedValueOnce({ conversations: [{
    ...savedConversation,
    id: "sourced-conversation",
    title: "Sourced answer",
    reportResult: null,
    messages: [{
      role: "assistant",
      content: "Hemoglobin carries oxygen.",
      citations: [{
        id: "hemoglobin-source", version: "1.2.0", title: "Hemoglobin overview", sourceUrl: "https://example.test/hemoglobin",
        publisher: "Reviewed medical publisher", reviewedAt: "2026-10-20T00:00:00.000Z", reviewExpiresAt: "2027-10-20T00:00:00.000Z",
      }],
    }],
  }] });
  render(<TestResultsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Sourced answer" }));
  expect(await screen.findByText(/version 1\.2\.0/)).toHaveTextContent("reviewed 20/10/2026");
  expect(screen.getByRole("link", { name: "Hemoglobin overview" })).toHaveAttribute("href", "https://example.test/hemoglobin");
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

test("a new chat omits the conversation ID and uses the saved ID only for its follow-up", async () => {
  request.mockResolvedValueOnce({ answer: "A new answer.", evidence: [], conversationId: "new-conversation" })
    .mockResolvedValueOnce({ answer: "A follow-up answer.", evidence: [], conversationId: "new-conversation" });
  render(<TestResultsPage />);
  await screen.findByRole("button", { name: savedConversation.title });
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "What could dizziness mean?" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  expect(await screen.findByText("A new answer.")).toBeInTheDocument();
  const first = JSON.parse(request.mock.calls[0][1].body);
  expect(first).not.toHaveProperty("conversationId");
  expect(first.history).toEqual([]);
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "Can you explain further?" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  expect(await screen.findByText("A follow-up answer.")).toBeInTheDocument();
  expect(JSON.parse(request.mock.calls[1][1].body).conversationId).toBe("new-conversation");
});

test("a missing saved conversation preserves the unsent question and lets the user retry as a new chat", async () => {
  request.mockRejectedValueOnce(Object.assign(new Error("Conversation not found."), { status: 404 }))
    .mockResolvedValueOnce({ answer: "Fresh chat answer.", evidence: [], conversationId: "replacement" });
  render(<TestResultsPage />);
  fireEvent.click(await screen.findByRole("button", { name: savedConversation.title }));
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "Keep this unsent question." } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Your message is still here");
  expect(screen.getByLabelText("Your message")).toHaveValue("Keep this unsent question.");
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  expect(await screen.findByText("Fresh chat answer.")).toBeInTheDocument();
  const retried = JSON.parse(request.mock.calls[1][1].body);
  expect(retried).not.toHaveProperty("conversationId");
  expect(retried.history).toEqual([]);
});
