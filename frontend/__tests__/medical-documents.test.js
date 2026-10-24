import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MedicalDocumentsPage from "../pages/medical-documents";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import { getMyProfile, addLinkedProfile } from "../lib/profileApi";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";
import { getMedicalDocuments, updateMedicalDocumentMetadata, uploadMedicalDocument } from "../lib/medicalDocumentApi";

jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
jest.mock("../lib/medicalDocumentApi", () => ({
  getMedicalDocuments: jest.fn(),
  uploadMedicalDocument: jest.fn(),
  updateMedicalDocumentMetadata: jest.fn(),
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
    updateMedicalDocumentMetadata.mockReset();
    mockStatus = "signedIn";
  });

  test("loads documents for the active profile and shows a helpful empty state", async () => {
    renderPage();
    expect(await screen.findByText(/No documents added yet/)).toBeInTheDocument();
    expect(getMedicalDocuments).toHaveBeenCalledWith("self");
    expect(screen.getByRole("button", { name: "Add medical documents" })).toBeInTheDocument();
    expect(screen.getByText(/Any file type up to 10 MB each/)).toBeInTheDocument();
  });

  test("uploads a selected PDF and displays the returned document", async () => {
    uploadMedicalDocument.mockResolvedValue({ document: { id: "doc-1", filename: "blood-test.pdf", documentType: "lab", documentDate: "2026-10-10", size: 2048, uploadedAt: "2026-10-12T10:00:00.000Z" } });
    renderPage();
    await screen.findByText(/No documents added yet/);
    fireEvent.change(screen.getByLabelText("Document type"), { target: { value: "lab" } });
    fireEvent.change(screen.getByLabelText("Document date (if known)"), { target: { value: "2026-10-10" } });
    const file = new File(["%PDF-1.4 test"], "blood-test.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Choose medical documents"), { target: { files: [file] } });
    expect(await screen.findByText("blood-test.pdf")).toBeInTheDocument();
    expect(uploadMedicalDocument).toHaveBeenCalledWith("self", expect.objectContaining({ filename: "blood-test.pdf", mimeType: "application/pdf", data: expect.any(String) }), { documentType: "lab", documentDate: "2026-10-10" });
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("href", "/api/medical-documents/doc-1/download?profileId=self");
    expect(await screen.findByRole("status")).toHaveTextContent("Document uploaded.");
  });

  test("uploads a DICOM X-ray file even when the browser does not identify its MIME type", async () => {
    uploadMedicalDocument.mockResolvedValue({ document: { id: "doc-dcm", filename: "scan.dcm", size: 12, uploadedAt: "2026-10-12T10:00:00.000Z" } });
    renderPage();
    await screen.findByText(/No documents added yet/);
    const file = new File(["dicom data"], "scan.dcm", { type: "" });
    fireEvent.change(screen.getByLabelText("Choose medical documents"), { target: { files: [file] } });
    expect(await screen.findByText("scan.dcm")).toBeInTheDocument();
    expect(uploadMedicalDocument).toHaveBeenCalledWith("self", expect.objectContaining({ filename: "scan.dcm", mimeType: "application/octet-stream" }), { documentType: "other", documentDate: "" });
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

  test("filters documents by type and clinical date range", async () => {
    getMedicalDocuments.mockResolvedValue({ documents: [
      { id: "doc-lab", filename: "blood-test.pdf", documentType: "lab", documentDate: "2026-10-12", size: 100, uploadedAt: "2026-10-13T10:00:00.000Z" },
      { id: "doc-image", filename: "xray.png", documentType: "imaging", documentDate: "2026-08-02", size: 100, uploadedAt: "2026-10-14T10:00:00.000Z" },
      { id: "doc-old-lab", filename: "old-test.pdf", documentType: "lab", documentDate: "2026-05-10", size: 100, uploadedAt: "2026-10-15T10:00:00.000Z" },
    ] });
    renderPage();
    expect(await screen.findByText("blood-test.pdf")).toBeInTheDocument();
    expect(screen.getByText("xray.png")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter by type"), { target: { value: "lab" } });
    fireEvent.change(screen.getByLabelText("Document date from"), { target: { value: "2026-10-01" } });
    expect(screen.getByText("blood-test.pdf")).toBeInTheDocument();
    expect(screen.queryByText("xray.png")).not.toBeInTheDocument();
    expect(screen.queryByText("old-test.pdf")).not.toBeInTheDocument();
  });

  test("lets users add or change type and clinical date for an existing document", async () => {
    const savedDocument = { id: "old-doc", filename: "old-scan.dcm", documentType: "other", documentDate: "", size: 500, uploadedAt: "2026-10-12T10:00:00.000Z" };
    getMedicalDocuments.mockResolvedValue({ documents: [savedDocument] });
    updateMedicalDocumentMetadata.mockResolvedValue({ ...savedDocument, documentType: "imaging", documentDate: "2026-09-01" });
    renderPage();
    expect(await screen.findByText("old-scan.dcm")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Edit type or date"));
    fireEvent.change(document.getElementById("edit-document-type-old-doc"), { target: { value: "imaging" } });
    fireEvent.change(document.getElementById("edit-document-date-old-doc"), { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Document details saved.");
    expect(updateMedicalDocumentMetadata).toHaveBeenCalledWith("self", "old-doc", { documentType: "imaging", documentDate: "2026-09-01" });
    expect(screen.getAllByText(/Imaging \(X-ray or scan\)/).find((element) => element.tagName === "P")).toHaveTextContent(/2026/);
  });
});
