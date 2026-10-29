import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProviderDetailPage from "../pages/providers/[id]";
import ProviderFacts from "../components/ProviderFacts";
import * as api from "../lib/providerApi";
let mockSignedIn = false;
let mockRouter = { isReady: true, query: { id: "test-hospital" } };
jest.mock("next/router", () => ({ useRouter: () => mockRouter }));
jest.mock("../components/SessionTimeout", () => ({ useSignedIn: () => mockSignedIn }));
jest.mock("../components/ProfileHeader", () => () => <header>Profile</header>);
jest.mock("../lib/providerApi", () => ({
  getProvider: jest.fn(), getMyProviderFeedback: jest.fn(), saveProviderFeedback: jest.fn(), removeProviderFeedback: jest.fn(),
  getMyProviderCorrections: jest.fn(), reportProviderCorrection: jest.fn(), removeProviderCorrection: jest.fn(),
}));
const provider = { id: "test-hospital", name: "Test Hospital", type: "hospital", city: "Beirut",
  address: "Test Street", latitude: null, longitude: null, specialties: [], services: [], hours: [], phone: "",
  insurances: ["nssf"], insuranceSources: ["https://example.test/coverage"], insuranceVerifiedAt: "2026-10-29T00:00:00Z",
  sources: ["https://example.test"], verifiedAt: "2026-10-29T00:00:00Z",
  feedback: { count: 0, averageRating: null, waiting: { level: "unknown", reportCount: 0 } } };
beforeEach(() => {
  jest.resetAllMocks(); mockSignedIn = false; mockRouter = { isReady: true, query: { id: "test-hospital" } };
  api.getProvider.mockResolvedValue(provider); api.getMyProviderFeedback.mockResolvedValue(null);
  api.getMyProviderCorrections.mockResolvedValue([]); api.saveProviderFeedback.mockResolvedValue({});
  api.removeProviderFeedback.mockResolvedValue({});
  api.reportProviderCorrection.mockResolvedValue({ status: "pending", message: "Report saved for review. Published information has not been changed." });
  api.removeProviderCorrection.mockResolvedValue({});
});
test("public detail has a canonical share link, unknown states and sign-in only for contributions", async () => {
  render(<ProviderDetailPage />);
  expect(await screen.findByRole("heading", { name: "Test Hospital" })).toBeInTheDocument();
  expect(screen.getByLabelText("Shareable link")).toHaveValue(window.location.origin + "/providers/test-hospital");
  expect(screen.getByRole("link", { name: /Sign in to leave feedback/ })).toHaveAttribute("href", "/login");
  expect(screen.getByText(/Waiting level: not enough/)).toBeInTheDocument();
  expect(screen.getByText(/Accepted insurance|Insurance and third-party payers: NSSF/)).toBeInTheDocument();
  expect(api.getMyProviderFeedback).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Save visit feedback" })).not.toBeInTheDocument();
});
test("missing providers and failed loading are explained and retryable", async () => {
  api.getProvider.mockRejectedValueOnce({ status: 404 }).mockResolvedValue(provider);
  const user = userEvent.setup(); render(<ProviderDetailPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Provider not found.");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "Test Hospital" })).toBeInTheDocument();
});
test("existing feedback can be edited without sending server-only fields back", async () => {
  mockSignedIn = true;
  api.getMyProviderFeedback.mockResolvedValue({ rating: 3, visitDate: "2026-10-28", note: "Earlier note", waitLevel: "long", waitReportedAt: "2026-10-28T12:00:00Z", updatedAt: "2026-10-28T12:00:00Z" });
  const user = userEvent.setup(); render(<ProviderDetailPage />);
  const save = await screen.findByRole("button", { name: "Save visit feedback" });
  await waitFor(() => expect(save).toBeEnabled());
  expect(screen.getByLabelText("Visit rating")).toHaveValue("3");
  await user.selectOptions(screen.getByLabelText("Visit rating"), "4");
  await user.click(save);
  await waitFor(() => expect(api.saveProviderFeedback).toHaveBeenCalledWith("test-hospital", {
    rating: 4, visitDate: "2026-10-28", note: "Earlier note", waitLevel: "", recentVisit: false,
  }));
  expect(await screen.findByText(/Your visit feedback was saved/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Remove my feedback" }));
  expect(api.removeProviderFeedback).toHaveBeenCalledWith("test-hospital");
  expect(await screen.findByText(/feedback and its waiting report were removed/)).toBeInTheDocument();
});
test("failed writes show an error and do not claim success", async () => {
  mockSignedIn = true; api.saveProviderFeedback.mockRejectedValue(new Error("Cannot save right now."));
  const user = userEvent.setup(); render(<ProviderDetailPage />);
  const save = await screen.findByRole("button", { name: "Save visit feedback" }); await waitFor(() => expect(save).toBeEnabled());
  await user.type(screen.getByLabelText("Visit date"), "2026-10-28");
  await user.click(save);
  expect(await screen.findByRole("alert")).toHaveTextContent("Cannot save right now.");
  expect(screen.queryByText(/Your visit feedback was saved/)).not.toBeInTheDocument();
});
test("private correction reports persist, show pending status and can be withdrawn", async () => {
  mockSignedIn = true; const user = userEvent.setup(); render(<ProviderDetailPage />);
  const send = await screen.findByRole("button", { name: "Send correction report" }); await waitFor(() => expect(send).toBeEnabled());
  await user.type(screen.getByLabelText("Correction details"), "Please verify the telephone.");
  await user.click(send);
  expect(api.reportProviderCorrection).toHaveBeenCalledWith("test-hospital", { field: "phone", details: "Please verify the telephone." });
  expect(await screen.findByText("Status: Pending review")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Published information has not been changed.");
  await user.click(screen.getByRole("button", { name: "Withdraw telephone report" }));
  expect(api.removeProviderCorrection).toHaveBeenCalledWith("test-hospital", "phone");
  expect(await screen.findByText("Your report was withdrawn.")).toBeInTheDocument();
});
test("a failed owner-data load prevents accidentally overwriting an existing contribution", async () => {
  mockSignedIn = true; api.getMyProviderFeedback.mockRejectedValueOnce(new Error("offline"));
  const user = userEvent.setup(); render(<ProviderDetailPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Retry before making changes.");
  expect(screen.getByRole("button", { name: "Save visit feedback" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Retry my contributions" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save visit feedback" })).toBeEnabled());
});
test("public waiting summaries include report age and never present an unknown as a short wait", () => {
  const view = render(<ProviderFacts provider={provider} />);
  expect(screen.queryByText("User-reported waiting level: short")).not.toBeInTheDocument();
  view.rerender(<ProviderFacts provider={{ ...provider, feedback: { count: 3, averageRating: 4.3,
    waiting: { level: "moderate", reportCount: 3, updatedAt: "2026-10-29T12:00:00Z" } } }} />);
  expect(screen.getByText("User-reported waiting level: moderate")).toBeInTheDocument();
  expect(screen.getByText(/Based on 3 reports in the past two hours/)).toBeInTheDocument();
  expect(screen.getByText(/not a live queue/)).toBeInTheDocument();
});
