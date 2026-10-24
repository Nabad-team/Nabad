import { fireEvent, render, screen, within } from "@testing-library/react";
import VisitPrepPage from "../pages/visit-prep";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";
import { getHealthProfile } from "../lib/healthProfileApi";
import { getSymptomsForProfile } from "../lib/symptomApi";
import { getMedicalDocuments } from "../lib/medicalDocumentApi";

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
    expect(getMedicalDocuments).toHaveBeenCalledWith(child.id);
  });

  test("attaches selected uploaded documents with profile-scoped download links", async () => {
    getMedicalDocuments.mockResolvedValue({ documents: [
      { id: "xray-1", filename: "chest-xray.pdf", documentType: "imaging", documentDate: "2026-10-20" },
      { id: "lab-1", filename: "blood-count.pdf", documentType: "lab", documentDate: "2026-10-12" },
    ] });

    renderPage();

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
    const print = jest.fn();
    window.print = print;

    renderPage();

    const button = await screen.findByRole("button", { name: "Print or save as PDF" });
    expect(screen.getByRole("heading", { name: "Patient and health background" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent symptom checks" })).toBeInTheDocument();

    fireEvent.click(button);

    expect(print).toHaveBeenCalledTimes(1);
    delete window.print;
  });
});
