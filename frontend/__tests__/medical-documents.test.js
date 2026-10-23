import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MedicalDocumentsPage from "../pages/medical-documents";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import { getMyProfile, addLinkedProfile } from "../lib/profileApi";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";
import { getMedicalDocuments, uploadMedicalDocument } from "../lib/medicalDocumentApi";

jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
jest.mock("../lib/medicalDocumentApi", () => ({
  getMedicalDocuments: jest.fn(),
  uploadMedicalDocument: jest.fn(),
  medicalDocumentDownloadUrl: (profileId, id) => `/api/medical-documents/${id}/download?profileId=${profileId}`,
}));
let mockStatus = "signedIn";
jest.mock("../components/SessionTimeout", () => ({
  ...jest.requireActual("../components/SessionTimeout"),
  useSessionStatus: () => mockStatus,
  useSignedIn: () => mockStatus === "signedIn",
}));

function renderPage() {
  return render(<ActiveProfileProvider><MedicalDocumentsPage /></ActiveProfileProvider>);
}

describe("Medical documents page", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
    getMedicalDocuments.mockReset().mockResolvedValue({ documents: [] });
    uploadMedicalDocument.mockReset();
    mockStatus = "signedIn";
  });

  test("loads documents for the active profile and shows a helpful empty state", async () => {
    renderPage();
    expect(await screen.findByText(/No documents added yet/)).toBeInTheDocument();
    expect(getMedicalDocuments).toHaveBeenCalledWith("self");
    expect(screen.getByRole("button", { name: "Add medical documents" })).toBeInTheDocument();
    expect(screen.getByText(/PDF, JPG, PNG and WebP files up to 10 MB each/)).toBeInTheDocument();
  });

  test("uploads a selected PDF and displays the returned document", async () => {
    uploadMedicalDocument.mockResolvedValue({ document: { id: "doc-1", filename: "blood-test.pdf", size: 2048, uploadedAt: "2026-10-12T10:00:00.000Z" } });
    renderPage();
    await screen.findByText(/No documents added yet/);
    const file = new File(["%PDF-1.4 test"], "blood-test.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Choose medical documents"), { target: { files: [file] } });
    expect(await screen.findByText("blood-test.pdf")).toBeInTheDocument();
    expect(uploadMedicalDocument).toHaveBeenCalledWith("self", expect.objectContaining({ filename: "blood-test.pdf", mimeType: "application/pdf", data: expect.any(String) }));
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("href", "/api/medical-documents/doc-1/download?profileId=self");
    expect(await screen.findByRole("status")).toHaveTextContent("Document uploaded.");
  });

  test("rejects unsupported files before calling the upload API", async () => {
    renderPage();
    await screen.findByText(/No documents added yet/);
    const file = new File(["not an image"], "scan.dcm", { type: "application/octet-stream" });
    fireEvent.change(screen.getByLabelText("Choose medical documents"), { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't a supported file/);
    expect(uploadMedicalDocument).not.toHaveBeenCalled();
  });

  test("loads the linked profile's documents when that profile is active", async () => {
    const child = await addLinkedProfile({ fullName: "Sami Haddad", dateOfBirth: "2018-04-02", relationship: "child" });
    localStorage.setItem("nabad-active-profile-id", child.id);
    getMedicalDocuments.mockResolvedValue({ documents: [{ id: "child-doc", filename: "child-xray.png", mimeType: "image/png", size: 1024, uploadedAt: "2026-10-12T10:00:00.000Z" }] });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Sami Haddad's documents" })).toBeInTheDocument();
    expect(await screen.findByText("child-xray.png")).toBeInTheDocument();
    await waitFor(() => expect(getMedicalDocuments).toHaveBeenCalledWith(child.id));
  });
});
