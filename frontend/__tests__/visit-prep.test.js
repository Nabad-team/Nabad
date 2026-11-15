import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import VisitPrepPage from "../pages/visit-prep";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";
import { getHealthProfile } from "../lib/healthProfileApi";
import { getSymptomsForProfile } from "../lib/symptomApi";
import { getMedicalDocuments } from "../lib/medicalDocumentApi";
import * as visitPrepExport from "../lib/visitPrepExport";
jest.mock("../lib/visitPrepExport", () => ({ exportVisitPrep: jest.fn() }));
import { createVisitPrepShare, getVisitPrep, getVisitPrepShares, revokeVisitPrepShare, saveVisitPrep } from "../lib/visitPrepApi";
import { exportVisitPrepPdf } from "../lib/visitPrepPdf";
jest.mock("../lib/visitPrepApi", () => ({
  getVisitPrep: jest.fn(), saveVisitPrep: jest.fn(), getVisitPrepShares: jest.fn(),
  createVisitPrepShare: jest.fn(), revokeVisitPrepShare: jest.fn(),
}));
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

// Links must still be active whenever the tests run, so their expiry is relative to today, not a fixed date.
const inAWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

// Edit, Print/PDF and Export are under "More"; this opens it (if needed) and returns the action's button.
async function moreAction(name) {
  const more = await screen.findByRole("button", { name: "More" });
  if (more.getAttribute("aria-expanded") !== "true") fireEvent.click(more);
  return screen.findByRole("button", { name });
}
// "Share with a doctor" opens the sharing panel.
async function openSharing() {
  fireEvent.click(await screen.findByRole("button", { name: "Share with a doctor" }));
}

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
    getVisitPrepShares.mockReset().mockResolvedValue({ shares: [] });
    createVisitPrepShare.mockReset();
    revokeVisitPrepShare.mockReset();
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

    fireEvent.click(await moreAction("Edit visit sheet"));
    const notes = screen.getByRole("textbox", { name: "Notes for your clinician" });
    fireEvent.change(notes, { target: { value: "Ask about headaches after exercise." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("heading", { name: "Notes for your clinician" })).toBeInTheDocument();
    expect(screen.getByText("Ask about headaches after exercise.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("included in this visit sheet and its printout");

    fireEvent.click((await moreAction("Edit visit sheet")));
    fireEvent.change(screen.getByRole("textbox", { name: "Notes for your clinician" }), { target: { value: "Discard this draft." } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Discard this draft.")).not.toBeInTheDocument();
    expect(screen.getByText("Ask about headaches after exercise.")).toBeInTheDocument();
  });

  test("has one primary action, Share with a doctor, and puts Edit, Print/PDF and Export under More", async () => {
    renderPage();
    const share = await screen.findByRole("button", { name: "Share with a doctor" });
    expect(share).toHaveClass("button--primary");
    // On the right of the title row, like every other page.
    expect(share.closest(".page-title__actions")).not.toBeNull();
    expect(document.querySelectorAll(".page-title__actions .button--primary")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "More" }).closest(".page-title__actions")).not.toBeNull();
    // Sharing is closed until asked for.
    expect(share).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: "Share securely with a doctor" })).not.toBeInTheDocument();
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    const panel = document.getElementById(more.getAttribute("aria-controls"));
    expect(within(panel).getAllByRole("button").map((button) => button.textContent)).toEqual(["Edit visit sheet", "Print or save as PDF", "Export sheet with attachments"]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(more).toHaveFocus();
    fireEvent.click(share);
    expect(share).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Share securely with a doctor" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Link expires after")).toHaveFocus());
  });

  test("shows the 5 newest symptom checks with Show all, while the shared link and export keep every check", async () => {
    getSymptomsForProfile.mockResolvedValue(Array.from({ length: 7 }, (_, index) => ({
      id: `check-${index}`, symptoms: `Symptom number ${index + 1}`, createdAt: `2026-11-0${7 - index}T10:00:00.000Z`, conversation: [],
    })));
    createVisitPrepShare.mockResolvedValue({ token: "t", share: { id: "s", createdAt: "2026-11-10T10:00:00.000Z", expiresAt: inAWeek, viewCount: 0 } });
    const exporter = visitPrepExport.exportVisitPrep.mockResolvedValue(undefined);
    renderPage();
    const list = await screen.findByRole("list", { name: "Recent symptom checks" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(7);
    expect(items.filter((item) => item.classList.contains("visit-prep__symptom--more"))).toHaveLength(2);
    expect(items[4]).not.toHaveClass("visit-prep__symptom--more");
    const toggle = screen.getByRole("button", { name: "Show all (7)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(within(list).getAllByRole("listitem").filter((item) => item.classList.contains("visit-prep__symptom--more"))).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Show the 5 newest" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Show the 5 newest" }));

    // Collapsed on screen, but the export and the doctor link still carry all 7, and never the button's label.
    fireEvent.click(await moreAction("Export sheet with attachments"));
    await waitFor(() => expect(exporter).toHaveBeenCalled());
    const [, exported] = exporter.mock.calls[0][0].sections.find(([title]) => title === "Recent symptom checks");
    expect(exported).toContain("Symptom number 7");
    expect(exported).not.toMatch(/Show all|newest/);
    exporter.mockReset();
    await openSharing();
    fireEvent.click(screen.getByRole("button", { name: "Create secure link" }));
    await waitFor(() => expect(createVisitPrepShare).toHaveBeenCalled());
    const shared = createVisitPrepShare.mock.calls[0][1].sections.find((section) => section.title === "Recent symptom checks");
    expect(shared.text).toContain("Symptom number 1");
    expect(shared.text).toContain("Symptom number 7");
  });

  test("keeps the sharing panel open while links exist, so a confirmation stays visible", async () => {
    getVisitPrepShares.mockResolvedValue({ shares: [{ id: "share-1", createdAt: "2026-11-03T10:00:00.000Z", expiresAt: inAWeek, viewCount: 1, confirmedAt: null, revokedAt: null }] });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Share securely with a doctor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share with a doctor" })).toHaveAttribute("aria-expanded", "true");
  });

  test("prints the prepared summary so it can be printed or saved as a PDF", async () => {

    renderPage();

    const button = await moreAction("Print or save as PDF");
    expect(screen.getByRole("heading", { name: "Patient and health background" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent symptom checks" })).toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() => expect(exportVisitPrepPdf).toHaveBeenCalledTimes(1));
  });

  test("edits generated background, medications and symptoms before sharing", async () => {
    renderPage();
    fireEvent.click(await moreAction("Edit visit sheet"));
    expect((await moreAction("Export sheet with attachments"))).toBeDisabled();
    for (const [label, value] of [["Patient and health background", "Corrected history"], ["Current medications", "Updated medication dose"], ["Recent symptom checks", "Symptoms started on Monday"]]) {
      fireEvent.change(screen.getByRole("textbox", { name: label }), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Patient and health background" })).not.toBeInTheDocument());
    expect(screen.getByText("Corrected history")).toBeInTheDocument();
    expect(screen.getByText("Updated medication dose")).toBeInTheDocument();
    expect(screen.getByText("Symptoms started on Monday")).toBeInTheDocument();
    expect(screen.queryByText("No active medications recorded.")).not.toBeInTheDocument();
    fireEvent.click((await moreAction("Edit visit sheet")));
    expect(screen.getByRole("textbox", { name: "Current medications" })).toHaveValue("Updated medication dose");
    fireEvent.change(screen.getByRole("textbox", { name: "Current medications" }), { target: { value: "Discard" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Updated medication dose")).toBeInTheDocument();
  });

  test("dates symptom checks and doctor links by the Beirut calendar day, also in the export", async () => {
    // 01:44 on 11 November in Beirut is 23:44 on 10 November in UTC: this used to show as "10 November 2026".
    getSymptomsForProfile.mockResolvedValue([{ id: "late-check", symptoms: "Chest tightness", createdAt: "2026-11-10T23:44:00.000Z", urgencyResult: { label: "Routine / self-care" }, conversation: [] }]);
    getVisitPrepShares.mockResolvedValue({ shares: [{ id: "share-late", createdAt: "2026-11-10T22:30:00.000Z", expiresAt: inAWeek, viewCount: 0, confirmedAt: null, revokedAt: null }] });
    const exporter = visitPrepExport.exportVisitPrep.mockResolvedValue(undefined);
    renderPage();
    const symptoms = await screen.findByRole("list", { name: "Recent symptom checks" });
    expect(symptoms).toHaveTextContent("11 November 2026, 01:44");
    expect(document.body).not.toHaveTextContent("10 November 2026");
    expect(await screen.findByText(/Created 11 November 2026/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/);
    fireEvent.click((await moreAction("Export sheet with attachments")));
    await waitFor(() => expect(exporter).toHaveBeenCalled());
    const [, text] = exporter.mock.calls[0][0].sections.find(([title]) => title === "Recent symptom checks");
    expect(text).toContain("11 November 2026, 01:44");
    exporter.mockReset();
  });

  test("exports saved edits with only selected attachments and reports export failures", async () => {
    const exporter = visitPrepExport.exportVisitPrep.mockResolvedValue(undefined);
    getMedicalDocuments.mockResolvedValue({ documents: [
      { id: "xray", filename: "scan.pdf", documentType: "imaging" },
      { id: "lab", filename: "lab.pdf", documentType: "lab" },
    ] });
    renderPage();
    fireEvent.click(await moreAction("Edit visit sheet"));
    fireEvent.change(screen.getByRole("textbox", { name: "Current medications" }), { target: { value: "Corrected dose" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Corrected dose");
    fireEvent.click(screen.getByRole("button", { name: "Choose uploaded documents" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /scan.pdf/ }));
    await screen.findByRole("heading", { name: "Documents attached to this visit" });
    fireEvent.click((await moreAction("Export sheet with attachments")));
    expect(exporter).toHaveBeenCalledWith(expect.objectContaining({
      sections: expect.arrayContaining([["Current medications", "Corrected dose"]]),
      documents: [expect.objectContaining({ id: "xray" })],
    }));
    expect(await moreAction("Export sheet with attachments")).toBeEnabled();
    exporter.mockRejectedValue(new Error("Could not attach scan.pdf"));
    fireEvent.click((await moreAction("Export sheet with attachments")));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not attach scan.pdf");
    exporter.mockReset();
  });

  test("restores saved sections, notes and document choices after remounting", async () => {
    let saved = { overrides: {}, notes: "", documentIds: [] };
    getVisitPrep.mockImplementation(async () => saved);
    saveVisitPrep.mockImplementation(async (id, sheet) => { saved = sheet; return sheet; });
    const view = renderPage();
    fireEvent.click(await moreAction("Edit visit sheet"));
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
    fireEvent.click(await moreAction("Edit visit sheet"));
    fireEvent.change(screen.getByRole("textbox", { name: "Notes for your clinician" }), { target: { value: "Unsaved note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
    expect(screen.getByRole("textbox", { name: "Notes for your clinician" })).toHaveValue("Unsaved note");
  });

  test("creates, displays and revokes an expiring secure doctor link", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    createVisitPrepShare.mockResolvedValue({
      token: "secure-token", share: { id: "share-1", createdAt: "2026-11-03T10:00:00.000Z", expiresAt: inAWeek, viewCount: 0, confirmedAt: null, revokedAt: null },
    });
    revokeVisitPrepShare.mockResolvedValue({ share: { id: "share-1", createdAt: "2026-11-03T10:00:00.000Z", expiresAt: inAWeek, viewCount: 0, confirmedAt: null, revokedAt: "2026-11-03T10:05:00.000Z" } });
    window.confirm = jest.fn(() => true);
    renderPage();

    await openSharing();
    fireEvent.click(await screen.findByRole("button", { name: "Create secure link" }));
    await waitFor(() => expect(createVisitPrepShare).toHaveBeenCalledWith("self", expect.objectContaining({
      patientName: "Demo User", expiresInDays: 7, documentIds: [], sections: expect.arrayContaining([expect.objectContaining({ title: "Current medications" })]),
    })));
    const link = await screen.findByRole("textbox", { name: /New secure link/ });
    expect(link.value).toMatch(/\/visit-prep-share\/secure-token$/);
    expect(writeText).toHaveBeenCalledWith(link.value);
    fireEvent.click(screen.getByRole("button", { name: "Copy secure link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("copied to your clipboard"));
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(revokeVisitPrepShare).toHaveBeenCalledWith("self", "share-1"));
    expect(await screen.findByText("Revoked")).toBeInTheDocument();
  });

  test("refreshes the patient's list to show clinician confirmation", async () => {
    getVisitPrepShares
      .mockResolvedValueOnce({ shares: [{ id: "share-1", createdAt: "2026-11-03T10:00:00.000Z", expiresAt: inAWeek, viewCount: 1, confirmedAt: null, revokedAt: null }] })
      .mockResolvedValueOnce({ shares: [{ id: "share-1", createdAt: "2026-11-03T10:00:00.000Z", expiresAt: inAWeek, viewCount: 2, confirmedAt: "2026-11-04T09:30:00.000Z", confirmedBy: "Dr Layla Khoury", revokedAt: null }] });
    renderPage();
    expect(await screen.findByText("Awaiting clinician confirmation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));
    expect(await screen.findByText("✓ Confirmed accurate by Dr Layla Khoury")).toBeInTheDocument();
    expect(screen.getByText(/confirmed 4 November 2026/)).toBeInTheDocument();
  });
});
