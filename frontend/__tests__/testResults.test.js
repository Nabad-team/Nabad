import { act, fireEvent, render, screen } from "@testing-library/react";
import TestResultsPage from "../pages/test-results";
import { getReportConversations } from "../lib/reportConversationApi";
import { request } from "../lib/api";

jest.mock("../components/ProfileHeader", () => () => <div />);
let mockActiveProfile;
jest.mock("../context/ActiveProfileContext", () => ({
  useActiveProfile: () => ({ activeProfile: mockActiveProfile }),
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
  request.mockReset();
  mockActiveProfile = { id: "self", fullName: "Maya" };
  getReportConversations.mockReset().mockResolvedValue({ conversations: [savedConversation] });
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
  expect(screen.getByRole("note")).toHaveTextContent("Follow-up questions use the saved AI explanation");
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

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function draftAndSend(question) {
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: question } });
  if (!screen.getByRole("checkbox").checked) fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}

test("switching profiles clears the private draft, selected report and consent", async () => {
  const view = render(<TestResultsPage />);
  fireEvent.click(await screen.findByRole("button", { name: savedConversation.title }));
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "Private question for Maya." } });
  fireEvent.click(screen.getByRole("checkbox"));
  getReportConversations.mockResolvedValueOnce({ conversations: [] });
  mockActiveProfile = { id: "child", fullName: "Child profile" };
  view.rerender(<TestResultsPage />);
  expect(screen.getByLabelText("Your message")).toHaveValue("");
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.queryByText(savedConversation.reportResult.summary)).not.toBeInTheDocument();
  expect(screen.queryByRole("note")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
});

test("an old request cannot change a new request even after switching back to the original profile", async () => {
  const old = deferred(); const current = deferred();
  request.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => current.promise);
  const view = render(<TestResultsPage />);
  await screen.findByRole("button", { name: savedConversation.title });
  draftAndSend("First private question.");
  const oldSignal = request.mock.calls[0][1].signal;
  mockActiveProfile = { id: "child", fullName: "Child profile" };
  view.rerender(<TestResultsPage />);
  expect(oldSignal.aborted).toBe(true);
  mockActiveProfile = { id: "self", fullName: "Maya" };
  view.rerender(<TestResultsPage />);
  draftAndSend("Current question.");
  await act(async () => old.resolve({ answer: "STALE_PRIVATE_ANSWER", evidence: [], conversationId: "stale-conversation" }));
  expect(screen.queryByText("STALE_PRIVATE_ANSWER")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Your message")).toHaveValue("Current question.");
  expect(screen.getByRole("button", { name: "Sending message" })).toBeDisabled();
  await act(async () => current.resolve({ answer: "Current answer.", evidence: [], conversationId: "current-conversation" }));
  expect(await screen.findByText("Current answer.")).toBeInTheDocument();
  expect(screen.getByLabelText("Your message")).toHaveValue("");
});

test("switching profiles while a file is being read prevents the old upload from being submitted", async () => {
  const reading = deferred();
  const view = render(<TestResultsPage />);
  await screen.findByRole("button", { name: savedConversation.title });
  const file = { name: "private-report.pdf", type: "application/pdf", size: 100, arrayBuffer: () => reading.promise };
  fireEvent.change(document.getElementById("test-report-file"), { target: { files: [file] } });
  draftAndSend("Explain my private report.");
  expect(request).not.toHaveBeenCalled();
  mockActiveProfile = { id: "child", fullName: "Child profile" };
  view.rerender(<TestResultsPage />);
  await act(async () => reading.resolve(new Uint8Array([1, 2, 3]).buffer));
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Your message")).toHaveValue("");
  expect(screen.getByRole("checkbox")).not.toBeChecked();
});

test("a late history refresh failure never displays the previous profile's error or clears the new draft", async () => {
  const refresh = deferred();
  getReportConversations.mockResolvedValueOnce({ conversations: [savedConversation] })
    .mockImplementationOnce(() => refresh.promise).mockResolvedValueOnce({ conversations: [] });
  request.mockResolvedValueOnce({ answer: "Saved answer.", evidence: [], conversationId: "saved-answer" });
  const view = render(<TestResultsPage />);
  await screen.findByRole("button", { name: savedConversation.title });
  draftAndSend("A question for Maya.");
  await screen.findByText("Saved answer.");
  mockActiveProfile = { id: "child", fullName: "Child profile" };
  view.rerender(<TestResultsPage />);
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "New profile draft." } });
  await act(async () => refresh.reject(new Error("Old refresh failed")));
  expect(screen.queryByText(/history list could not be refreshed/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Your message")).toHaveValue("New profile draft.");
});

test("repeated submit events create one request and unmount cancels it", async () => {
  const pending = deferred(); request.mockImplementationOnce(() => pending.promise);
  const view = render(<TestResultsPage />);
  await screen.findByRole("button", { name: savedConversation.title });
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "One question." } });
  fireEvent.click(screen.getByRole("checkbox"));
  const form = screen.getByLabelText("Your message").closest("form");
  act(() => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(request).toHaveBeenCalledTimes(1);
  const signal = request.mock.calls[0][1].signal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve({ answer: "Late answer.", evidence: [], conversationId: "late" }));
  expect(getReportConversations).toHaveBeenCalledTimes(1);
});
