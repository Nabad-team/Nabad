// Automated tests for the "My medications" page.
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MedicationsPage from "../pages/medications";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

// Full-page flows: slow under load for a good reason (see test-utils/timeouts.js).
jest.setTimeout(PAGE_FLOW_TIMEOUT);

jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
jest.mock("../components/SessionTimeout", () => ({
  ...jest.requireActual("../components/SessionTimeout"),
  useSessionStatus: () => "signedIn",
  useSignedIn: () => true,
}));

// A small in-memory stand-in for the backend, sorted like the real list: active first, newest first.
// Like the backend, every call names the profile, and a medication is only found through its own profile.
let mockMedications = [];
let mockNextId = 1;
const sorted = (profileId) => mockMedications
  .filter((m) => m.profileId === profileId)
  .sort((a, b) => (a.status === b.status ? b.order - a.order : a.status === "active" ? -1 : 1));
function mockFind(profileId, id) {
  const medication = mockMedications.find((m) => m.id === id && m.profileId === profileId);
  if (!medication) throw Object.assign(new Error("Medication not found."), { status: 404 });
  return medication;
}
const mockApi = {
  getMedications: jest.fn(async (profileId) => sorted(profileId).map(({ order, ...m }) => m)),
  addMedication: jest.fn(async (profileId, fields) => {
    const medication = { id: String(mockNextId), order: mockNextId++, profileId, status: "active", ...fields };
    mockMedications.push(medication);
    return medication;
  }),
  updateMedication: jest.fn(async (profileId, id, fields) => Object.assign(mockFind(profileId, id), fields)),
  setMedicationStatus: jest.fn(async (profileId, id, status) => Object.assign(mockFind(profileId, id), { status })),
  deleteMedication: jest.fn(async (profileId, id) => {
    mockFind(profileId, id);
    mockMedications = mockMedications.filter((m) => m.id !== id);
  }),
};
jest.mock("../lib/medicationApi", () => ({
  MEDICATION_FORMS: ["tablet", "syrup", "injection", "inhaler", "drops", "other"],
  getMedications: (...args) => mockApi.getMedications(...args),
  addMedication: (...args) => mockApi.addMedication(...args),
  updateMedication: (...args) => mockApi.updateMedication(...args),
  setMedicationStatus: (...args) => mockApi.setMedicationStatus(...args),
  deleteMedication: (...args) => mockApi.deleteMedication(...args),
}));

function seed(fields) {
  mockMedications.push({
    id: String(mockNextId), order: mockNextId++, profileId: "self", name: "Paracetamol", dose: "500", unit: "mg", form: "tablet",
    frequency: "twice a day", startDate: "2026-09-01", endDate: "", status: "active", notes: "", ...fields,
  });
}

function renderPage() {
  return render(
    <ActiveProfileProvider>
      <MedicationsPage />
    </ActiveProfileProvider>
  );
}
const list = () => screen.findByRole("list", { name: "Your medications" });
const item = async (name) => within(await list()).getByRole("heading", { name }).closest("li");

describe("Medications page", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
    mockMedications = [];
    mockNextId = 1;
    jest.clearAllMocks();
  });

  test("shows the empty state when there are no medications yet", async () => {
    renderPage();
    expect(await screen.findByText("No medications yet.")).toBeInTheDocument();
    expect(screen.getByText("Add the ones you take so they're ready for your doctor.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add medication" })).toBeInTheDocument();
  });

  test("lists medications with dose, how often, dates and a status badge, active first", async () => {
    seed({ name: "Ventolin", dose: "2", unit: "puffs", form: "inhaler", frequency: "when needed", status: "discontinued", startDate: "2026-01-05", endDate: "2026-03-10" });
    seed({ name: "Paracetamol", notes: "After food" });
    renderPage();

    const names = within(await list()).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(names).toEqual(["Paracetamol", "Ventolin"]);

    const paracetamol = await item("Paracetamol");
    expect(within(paracetamol).getByText("500 mg tablet · twice a day")).toBeInTheDocument();
    expect(within(paracetamol).getByText("Since 1 September 2026")).toBeInTheDocument();
    expect(within(paracetamol).getByText("Active")).toBeInTheDocument();
    expect(within(paracetamol).getByText("After food")).toBeInTheDocument();

    const ventolin = await item("Ventolin");
    expect(within(ventolin).getByText("2 puffs inhaler · when needed")).toBeInTheDocument();
    expect(within(ventolin).getByText("5 January 2026 to 10 March 2026")).toBeInTheDocument();
    expect(within(ventolin).getByText("Discontinued")).toBeInTheDocument();
  });

  test("adds a medication", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add medication" }));

    const form = screen.getByRole("form", { name: "Add a medication" });
    expect(within(form).getByLabelText("Medication name")).toHaveFocus();
    await user.type(within(form).getByLabelText("Medication name"), "  Amoxicillin ");
    await user.type(within(form).getByLabelText("Dose"), "250");
    await user.type(within(form).getByLabelText("Unit"), "mg");
    await user.selectOptions(within(form).getByLabelText("Form"), "syrup");
    await user.type(within(form).getByLabelText("How often"), "three times a day");
    await user.clear(within(form).getByLabelText("Start date"));
    await user.type(within(form).getByLabelText("Start date"), "2026-10-01");
    await user.click(within(form).getByRole("button", { name: "Save medication" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Amoxicillin was added to your list.");
    expect(mockApi.addMedication).toHaveBeenCalledWith("self", {
      name: "Amoxicillin", dose: "250", unit: "mg", form: "syrup", frequency: "three times a day", startDate: "2026-10-01", endDate: "", notes: "",
    });
    expect(within(await item("Amoxicillin")).getByText("250 mg syrup · three times a day")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Add a medication" })).not.toBeInTheDocument();
  });

  test("explains what's wrong instead of saving an invalid medication", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add medication" }));
    const form = screen.getByRole("form", { name: "Add a medication" });

    await user.click(within(form).getByRole("button", { name: "Save medication" }));
    const name = within(form).getByLabelText("Medication name");
    expect(name).toHaveAccessibleDescription("Enter the medication name.");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveFocus();

    await user.type(name, "Aspirin");
    await user.type(within(form).getByLabelText("End date (optional)"), "2000-01-01");
    await user.click(within(form).getByRole("button", { name: "Save medication" }));
    expect(within(form).getByLabelText("End date (optional)")).toHaveAccessibleDescription("The end date can't be before the start date.");
    expect(mockApi.addMedication).not.toHaveBeenCalled();
  });

  test("shows the server's message when saving fails", async () => {
    const user = userEvent.setup({ delay: null });
    mockApi.addMedication.mockRejectedValueOnce(new Error("Too many changes in a short time. Please wait a few minutes and try again."));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add medication" }));
    await user.type(screen.getByLabelText("Medication name"), "Aspirin");
    await user.click(screen.getByRole("button", { name: "Save medication" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many changes in a short time.");
  });

  test("edits a medication", async () => {
    const user = userEvent.setup({ delay: null });
    seed({ name: "Paracetamol" });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit Paracetamol" }));

    const form = screen.getByRole("form", { name: "Edit Paracetamol" });
    expect(within(form).getByLabelText("Dose")).toHaveValue("500");
    await user.clear(within(form).getByLabelText("Dose"));
    await user.type(within(form).getByLabelText("Dose"), "1000");
    await user.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Your changes to Paracetamol were saved.");
    expect(mockApi.updateMedication).toHaveBeenCalledWith("self", "1", expect.objectContaining({ name: "Paracetamol", dose: "1000" }));
    expect(within(await item("Paracetamol")).getByText("1000 mg tablet · twice a day")).toBeInTheDocument();
  });

  test("cancelling an edit keeps the medication as it was", async () => {
    const user = userEvent.setup({ delay: null });
    seed({ name: "Paracetamol" });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit Paracetamol" }));
    await user.type(screen.getByLabelText("Dose"), "999");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(within(await item("Paracetamol")).getByText("500 mg tablet · twice a day")).toBeInTheDocument();
    expect(mockApi.updateMedication).not.toHaveBeenCalled();
  });

  test("marks a medication as discontinued and active again", async () => {
    const user = userEvent.setup({ delay: null });
    seed({ name: "Paracetamol" });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Mark as discontinued: Paracetamol" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Paracetamol is marked as discontinued.");
    expect(mockApi.setMedicationStatus).toHaveBeenCalledWith("self", "1", "discontinued");
    expect(within(await item("Paracetamol")).getByText("Discontinued")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark as active again: Paracetamol" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Paracetamol is marked as active again.");
    expect(mockApi.setMedicationStatus).toHaveBeenLastCalledWith("self", "1", "active");
    await waitFor(async () => expect(within(await item("Paracetamol")).getByText("Active")).toBeInTheDocument());
  });

  test("asks for confirmation before deleting, and keeping it changes nothing", async () => {
    const user = userEvent.setup({ delay: null });
    seed({ name: "Paracetamol" });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete Paracetamol" }));
    const dialog = screen.getByRole("dialog", { name: "Delete Paracetamol?" });
    expect(within(dialog).getByText("It will be removed from your list. This can't be undone.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Keep it" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockApi.deleteMedication).not.toHaveBeenCalled();
    expect(await item("Paracetamol")).toBeInTheDocument();
  });

  test("deletes a medication after confirmation and shows the empty state", async () => {
    const user = userEvent.setup({ delay: null });
    seed({ name: "Paracetamol" });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete Paracetamol" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Yes, delete" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Paracetamol was deleted.");
    expect(mockApi.deleteMedication).toHaveBeenCalledWith("self", "1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByText("No medications yet.")).toBeInTheDocument();
  });

  test("offers to try again when the list can't be loaded", async () => {
    const user = userEvent.setup({ delay: null });
    mockApi.getMedications.mockRejectedValueOnce(new Error("Network down"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your medications.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No medications yet.")).toBeInTheDocument();
  });

  test("has the page title and a Medications link in the header", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "My medications" })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Medications" })).toHaveAttribute("href", "/medications");
  });

  test("is only shown to signed-in users", () => {
    expect(MedicationsPage.requireSignIn).toBe(true);
  });
});

describe("Medications for a family member", () => {
  let childId;
  beforeEach(async () => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
    mockMedications = [];
    mockNextId = 1;
    jest.clearAllMocks();
    childId = (await fakeProfileApi.addLinkedProfile({ fullName: "Sami Haddad", dateOfBirth: "2018-04-02", relationship: "child" })).id;
    seed({ name: "My own pill" });
    seed({ name: "Sami syrup", form: "syrup", dose: "5", unit: "ml", profileId: childId });
  });
  const actAsChild = () => localStorage.setItem("nabad-active-profile-id", childId);
  const childList = () => screen.findByRole("list", { name: "Medications for Sami Haddad" });
  const childItem = async (name) => within(await childList()).getByRole("heading", { name }).closest("li");

  test("shows the family member's list with their name, and the Acting as banner", async () => {
    actAsChild();
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Medications for Sami Haddad" })).toBeInTheDocument();
    expect(screen.getByText("Acting as: Sami Haddad (child)")).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
    const names = within(await childList()).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(names).toEqual(["Sami syrup"]);
    expect(mockApi.getMedications).toHaveBeenCalledWith(childId);
  });

  test("a caregiver adds, edits, changes and deletes a family member's medication", async () => {
    const user = userEvent.setup({ delay: null });
    actAsChild();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Add medication" }));
    await user.type(screen.getByLabelText("Medication name"), "Ventolin");
    await user.click(screen.getByRole("button", { name: "Save medication" }));
    expect(await screen.findByText("Ventolin was added to Sami Haddad's list.")).toBeInTheDocument();
    expect(mockApi.addMedication).toHaveBeenCalledWith(childId, expect.objectContaining({ name: "Ventolin" }));

    await user.click(screen.getByRole("button", { name: "Edit Sami syrup" }));
    await user.clear(screen.getByLabelText("Dose"));
    await user.type(screen.getByLabelText("Dose"), "10");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Your changes to Sami syrup were saved.")).toBeInTheDocument();
    expect(within(await childItem("Sami syrup")).getByText("10 ml syrup · twice a day")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark as discontinued: Sami syrup" }));
    expect(await screen.findByText("Sami syrup is marked as discontinued.")).toBeInTheDocument();
    expect(mockApi.setMedicationStatus).toHaveBeenCalledWith(childId, "2", "discontinued");

    await user.click(screen.getByRole("button", { name: "Delete Sami syrup" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Yes, delete" }));
    expect(await screen.findByText("Sami syrup was deleted.")).toBeInTheDocument();
    expect(mockApi.deleteMedication).toHaveBeenCalledWith(childId, "2");

    // The caregiver's own list was never touched.
    expect(mockMedications.filter((m) => m.profileId === "self").map((m) => m.name)).toEqual(["My own pill"]);
  });

  test("switching profiles in the header shows the right list", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "My medications" })).toBeInTheDocument();
    expect(within(await list()).getByRole("heading", { name: "My own pill" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Active profile"), childId);
    expect(await screen.findByRole("heading", { level: 1, name: "Medications for Sami Haddad" })).toBeInTheDocument();
    const childNames = within(await childList()).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(childNames).toEqual(["Sami syrup"]);

    await user.selectOptions(screen.getByLabelText("Active profile"), "self");
    expect(await screen.findByRole("heading", { level: 1, name: "My medications" })).toBeInTheDocument();
    const ownNames = within(await list()).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(ownNames).toEqual(["My own pill"]);
  });

  test("shows the family member's empty state in their name", async () => {
    mockMedications = mockMedications.filter((m) => m.profileId !== childId);
    actAsChild();
    renderPage();
    expect(await screen.findByText("No medications yet.")).toBeInTheDocument();
    expect(screen.getByText("Add the ones Sami Haddad takes so they're ready for their doctor.")).toBeInTheDocument();
  });

  test("after a family member is removed, the page goes back to the caregiver's own list", async () => {
    actAsChild();
    await fakeProfileApi.removeLinkedProfile(childId);
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "My medications" })).toBeInTheDocument();
    expect(within(await list()).getByRole("heading", { name: "My own pill" })).toBeInTheDocument();
    expect(mockApi.getMedications).not.toHaveBeenCalledWith(childId);
  });
});
