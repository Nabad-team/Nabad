import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SharedVisitPrepPage from "../pages/visit-prep-share/[token]";
import { confirmSharedVisitPrep, getSharedVisitPrep } from "../lib/visitPrepApi";

jest.mock("next/router", () => ({ useRouter: () => ({ isReady: true, query: { token: "share-token" } }) }));
jest.mock("../lib/visitPrepApi", () => ({
  getSharedVisitPrep: jest.fn(), confirmSharedVisitPrep: jest.fn(),
  sharedDocumentDownloadUrl: (token, id) => `/api/visit-prep-shares/public/${token}/documents/${id}`,
}));

const sheet = {
  patientName: "Rana Haddad", createdAt: "2026-11-03T10:00:00.000Z", expiresAt: "2026-11-10T10:00:00.000Z",
  confirmedAt: null, confirmedBy: "", sections: [{ title: "Current medications", text: "Inhaler as needed" }],
  documents: [{ id: "document-1", filename: "lab.pdf" }],
};

beforeEach(() => {
  getSharedVisitPrep.mockReset().mockResolvedValue(sheet);
  confirmSharedVisitPrep.mockReset().mockResolvedValue({ confirmedAt: "2026-11-03T11:00:00.000Z", confirmedBy: "Dr Layla Khoury" });
});

test("shows the frozen visit sheet and token-scoped attachment", async () => {
  render(<SharedVisitPrepPage />);
  expect(await screen.findByText("Rana Haddad")).toBeInTheDocument();
  expect(screen.getByText("Inhaler as needed")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "lab.pdf" })).toHaveAttribute("href", "/api/visit-prep-shares/public/share-token/documents/document-1");
});

test("requires attestation and records immutable clinician confirmation", async () => {
  render(<SharedVisitPrepPage />);
  await screen.findByText("Rana Haddad");
  fireEvent.change(screen.getByRole("textbox", { name: "Your name" }), { target: { value: "Dr Layla Khoury" } });
  fireEvent.click(screen.getByRole("button", { name: "Mark as accurate" }));
  expect(screen.getByRole("alert")).toHaveTextContent("confirm that the sheet is accurate");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Mark as accurate" }));
  await waitFor(() => expect(confirmSharedVisitPrep).toHaveBeenCalledWith("share-token", "Dr Layla Khoury"));
  expect(await screen.findByRole("status")).toHaveTextContent("Marked accurate by Dr Layla Khoury");
  expect(screen.queryByRole("button", { name: "Mark as accurate" })).not.toBeInTheDocument();
});

test("shows expired and revoked link errors without exposing a partial sheet", async () => {
  getSharedVisitPrep.mockRejectedValue(new Error("This shared link has expired."));
  render(<SharedVisitPrepPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("expired");
  expect(screen.queryByText("Rana Haddad")).not.toBeInTheDocument();
});
