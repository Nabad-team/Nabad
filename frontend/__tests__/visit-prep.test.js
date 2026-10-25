import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import VisitPrepPage from "../pages/visit-prep";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";
import { getHealthProfile } from "../lib/healthProfileApi";
import { getSymptomsForProfile } from "../lib/symptomApi";
import { getMedicalDocuments } from "../lib/medicalDocumentApi";
import * as visitPrepExport from "../lib/visitPrepExport";
jest.mock("../lib/visitPrepExport", () => ({ exportVisitPrep: jest.fn() }));
import { getVisitPrep, saveVisitPrep } from "../lib/visitPrepApi";
import { exportVisitPrepPdf } from "../lib/visitPrepPdf";
jest.mock("../lib/visitPrepApi", () => ({ getVisitPrep: jest.fn(), saveVisitPrep: jest.fn() }));
jest.mock("../lib/visitPrepPdf", () => ({ exportVisitPrepPdf: jest.fn() }));

jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
jest.mock("../lib/healthProfileApi", () => ({ getHealthProfile: jest.fn() }));
jest.mock("../lib/symptomApi", () => ({ getSymptomsForProfile: jest.fn() }));
jest.mock("../lib/medicalDocumentApi", () => ({
  getMedicalDocuments: jest.fn(),
  medicalDocumentDownloadUrl: (profileId, id) => `/api/medical-documents/${id}/download?profileId=${profileId}`,
}));
jest.mock("../components/SessionTimeout", () => ({
  ...jest.requireActual("../components/SessionTimeout"),
  useSessionStatus: () => "signedIn",
  useSignedIn: () => true,
}));

function renderPage() {
  return render(<ActiveProfileProvider><VisitPrepPage /></ActiveProfileProvider>);
}

describe("Visit preparation page", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
    getHealthProfile.mockReset().mockResolvedValue({ dateOfBirth: "1990-04-12", age: { years: 36, text: "36 years" }, facts: [] });
    getSymptomsForProfile.mockReset().mockResolvedValue([]);
    getMedicalDocuments.mockReset().mockResolvedValue({ documents: [] });
    getVisitPrep.mockReset().mockResolvedValue({ overrides: {}, notes: "", documentIds: [] });
    saveVisitPrep.mockReset().mockResolvedValue({});
    exportVisitPrepPdf.mockReset().mockResolvedValue(undefined);
  });

  test("loads the active profile's history and includes allergy type and reaction", async () => {
    getHealthProfile.mockResolvedValue({
      dateOfBirth: "1990-04-12",
      age: { years: 36, text: "36 years" },
      facts: [
        { id: "allergy-1", category: "allergy", value: { type: "medication", name: "Penicillin", reaction: "Hives" } },
        { id: "condition-1", category: "condition", value: { code: "asthma" } },
      ],
      medications: [
        { id: "med-1", name: "IroDef", dose: "25", unit: "mg", form: "tablet", frequency: "Every morning" },
        { id: "med-2", name: "Rescue inhaler", form: "inhaler", frequency: "As needed" },
      ],
      suggestions: [{ id: "suggested-1", category: "condition", value: { code: "diabetes" }, status: "suggested" }],
    });
    getSymptomsForProfile.mockResolvedValue([{
      id: "symptom-1",
      symptoms: "Headache since yesterday",
      createdAt: "2026-10-20T10:30:00.000Z",
      urgencyResult: { label: "Needs attention soon" },
      conversation: [
        { role: "patient", content: "Headache since yesterday" },
        { role: "assistant", content: "Saved result" },
        { role: "patient", content: "Pain level: moderate" },
        { role: "assistant", content: "Follow-up saved" },
      ],
    }]);

    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Visit preparation" })).toBeInTheDocument();
    expect(await screen.findByText("Penicillin (Medication; reaction: Hives)")).toBeInTheDocument();
    expect(getHealthProfile).toHaveBeenCalledWith("self");
    expect(getSymptomsForProfile).toHaveBeenCalledWith("self");
    expect(screen.getByText("Asthma")).toBeInTheDocument();
    expect(screen.queryByText("Diabetes")).not.toBeInTheDocument();
    const medicationList = screen.getByRole("list", { name: "Current medications" });
    expect(within(medicationList).getByText("IroDef")).toBeInTheDocument();
    expect(within(medicationList).getByText(/25 mg · Tablet · Every morning/)).toBeInTheDocument();
    expect(within(medicationList).getByText(/Inhaler · As needed/)).toBeInTheDocument();
    const symptomList = await screen.findByRole("list", { name: "Recent symptom checks" });
    expect(within(symptomList).getByText("Headache since yesterday")).toBeInTheDocument();
    expect(within(symptomList).getByText("Pain level: moderate")).toBeInTheDocument();
    expect(within(symptomList).getByText(/Needs attention soon/)).toBeInTheDocument();
  });

  test("shows a clear empty state when no health facts or symptom checks are saved", async () => {
    renderPage();

    expect(await screen.findByText(/No confirmed conditions, allergies or other background information recorded/)).toBeInTheDocument();
    expect(screen.getByText("No active medications recorded.")).toBeInTheDocument();
    expect(screen.getByText("No saved symptom checks yet.")).toBeInTheDocument();
  });

  test("requests both summaries for the selected linked profile", async () => {
    const child = await fakeProfileApi.addLinkedProfile({ fullName: "Sami Haddad", dateOfBirth: "2018-04-02", relationship: "child" });
    localStorage.setItem("nabad-active-profile-id", child.id);
    getHealthProfile.mockResolvedValue({ dateOfBirth: "2018-04-02", age: { years: 8, text: "8 years" }, facts: [] });

    renderPage();

    expect(await screen.findByText("Sami Haddad")).toBeInTheDocument();
    expect(await screen.findByText("No saved symptom checks yet.")).toBeInTheDocument();
    expect(getHealthProfile).toHaveBeenCalledWith(child.id);
    expect(getSymptomsForProfile).toHaveBeenCalledWith(child.id);
    expect(getMedicalDocuments).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Choose uploaded documents" }));
    expect(getMedicalDocuments).toHaveBeenCalledWith(child.id);
    expect(await screen.findByText(/No uploaded documents for this profile/)).toBeInTheDocument();
  });

  test("attaches selected uploaded documents with profile-scoped download links", async () => {
    getMedicalDocuments.mockResolvedValue({ documents: [
      { id: "xray-1", filename: "chest-xray.pdf", documentType: "imaging", documentDate: "2026-10-20" },
      { id: "lab-1", filename: "blood-count.pdf", documentType: "lab", documentDate: "2026-10-12" },
    ] });

    renderPage();

    expect(getMedicalDocuments).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Choose uploaded documents" }));
    const xray = await screen.findByRole("checkbox", { name: /chest-xray\.pdf/ });
    fireEvent.click(xray);

    const attached = await screen.findByRole("heading", { name: "Documents attached to this visit" });
    const attachmentCard = attached.closest("section");
    expect(within(attachmentCard).getByText("chest-xray.pdf")).toBeInTheDocument();
    expect(within(attachmentCard).getByRole("link", { name: "Download" })).toHaveAttribute("href", "/api/medical-documents/xray-1/download?profileId=self");
    expect(within(attachmentCard).queryByText("blood-count.pdf")).not.toBeInTheDocument();
  });

  test("lets the user review and add notes, and cancel discards an uncommitted draft", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Edit visit sheet" }));
    const notes = screen.getByRole("textbox", { name: "Notes for your clinician" });
    fireEvent.change(notes, { target: { value: "Ask about headaches after exercise." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("heading", { name: "Notes for your clinician" })).toBeInTheDocument();
    expect(screen.getByText("Ask about headaches after exercise.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("included in this visit sheet and its printout");

    fireEvent.click(screen.getByRole("button", { name: "Edit visit sheet" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Notes for your clinician" }), { target: { value: "Discard this draft." } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Discard this draft.")).not.toBeInTheDocument();
    expect(screen.getByText("Ask about headaches after exercise.")).toBeInTheDocument();
  });

  test("prints the prepared summary so it can be printed or saved as a PDF", async () => {

    renderPage();

    const button = await screen.findByRole("button", { name: "Print or save as PDF" });
    expect(screen.getByRole("heading", { name: "Patient and health background" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent symptom checks" })).toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() => expect(exportVisitPrepPdf).toHaveBeenCalledTimes(1));
  });

  test("edits generated background, medications and symptoms before sharing", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit visit sheet" }));
    expect(screen.getByRole("button", { name: "Export sheet with attachments" })).toBeDisabled();
    for (const [label, value] of [["Patient and health background", "Corrected history"], ["Current medications", "Updated medication dose"], ["Recent symptom checks", "Symptoms started on Monday"]]) {
      fireEvent.change(screen.getByRole("textbox", { name: label }), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Patient and health background" })).not.toBeInTheDocument());
    expect(screen.getByText("Corrected history")).toBeInTheDocument();
    expect(screen.getByText("Updated medication dose")).toBeInTheDocument();
    expect(screen.getByText("Symptoms started on Monday")).toBeInTheDocument();
    expect(screen.queryByText("No active medications recorded.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit visit sheet" }));
    expect(screen.getByRole("textbox", { name: "Current medications" })).toHaveValue("Updated medication dose");
    fireEvent.change(screen.getByRole("textbox", { name: "Current medications" }), { target: { value: "Discard" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Updated medication dose")).toBeInTheDocument();
  });

  test("exports saved edits with only selected attachments and reports export failures", async () => {
    const exporter = visitPrepExport.exportVisitPrep.mockResolvedValue(undefined);
    getMedicalDocuments.mockResolvedValue({ documents: [
      { id: "xray", filename: "scan.pdf", documentType: "imaging" },
      { id: "lab", filename: "lab.pdf", documentType: "lab" },
    ] });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit visit sheet" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Current medications" }), { target: { value: "Corrected dose" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Corrected dose");
    fireEvent.click(screen.getByRole("button", { name: "Choose uploaded documents" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /scan.pdf/ }));
    await screen.findByRole("heading", { name: "Documents attached to this visit" });
    fireEvent.click(screen.getByRole("button", { name: "Export sheet with attachments" }));
    expect(exporter).toHaveBeenCalledWith(expect.objectContaining({
      sections: expect.arrayContaining([["Current medications", "Corrected dose"]]),
      documents: [expect.objectContaining({ id: "xray" })],
    }));
    expect(await screen.findByRole("button", { name: "Export sheet with attachments" })).toBeEnabled();
    exporter.mockRejectedValue(new Error("Could not attach scan.pdf"));
    fireEvent.click(screen.getByRole("button", { name: "Export sheet with attachments" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not attach scan.pdf");
    exporter.mockReset();
  });

  test("restores saved sections, notes and document choices after remounting", async () => {
    let saved = { overrides: {}, notes: "", documentIds: [] };
    getVisitPrep.mockImplementation(async () => saved);
    saveVisitPrep.mockImplementation(async (id, sheet) => { saved = sheet; return sheet; });
    const view = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit visit sheet" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Notes for your clinician" }), { target: { value: "Keep this note" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Current medications" }), { target: { value: "Saved dose" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Keep this note");
    view.unmount(); renderPage();
    expect(await screen.findByText("Keep this note")).toBeInTheDocument();
    expect(screen.getByText("Saved dose")).toBeInTheDocument();
    expect(saveVisitPrep).toHaveBeenCalledWith("self", expect.objectContaining({ notes: "Keep this note" }));
  });

  test("keeps the edit draft open if saving fails", async () => {
    saveVisitPrep.mockRejectedValue(new Error("Connection lost"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit visit sheet" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Notes for your clinician" }), { target: { value: "Unsaved note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
    expect(screen.getByRole("textbox", { name: "Notes for your clinician" })).toHaveValue("Unsaved note");
  });
});
