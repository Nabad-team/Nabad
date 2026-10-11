// Automated tests for the "My medications" page.
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MedicationsPage from "../pages/medications";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";

jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
jest.mock("../components/SessionTimeout", () => ({
  ...jest.requireActual("../components/SessionTimeout"),
  useSessionStatus: () => "signedIn",
  useSignedIn: () => true,
}));

// A small in-memory stand-in for the backend, sorted like the real list: active first, newest first.
let mockMedications = [];
let mockNextId = 1;
const sorted = () => [...mockMedications].sort((a, b) => (a.status === b.status ? b.order - a.order : a.status === "active" ? -1 : 1));
const mockApi = {
  getMedications: jest.fn(async () => sorted().map(({ order, ...m }) => m)),
  addMedication: jest.fn(async (fields) => {
    const medication = { id: String(mockNextId), order: mockNextId++, status: "active", ...fields };
    mockMedications.push(medication);
    return medication;
  }),
  updateMedication: jest.fn(async (id, fields) => {
    const medication = mockMedications.find((m) => m.id === id);
    Object.assign(medication, fields);
    return medication;
  }),
  setMedicationStatus: jest.fn(async (id, status) => {
    const medication = mockMedications.find((m) => m.id === id);
    medication.status = status;
    return medication;
  }),
  deleteMedication: jest.fn(async (id) => {
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
    id: String(mockNextId), order: mockNextId++, name: "Paracetamol", dose: "500", unit: "mg", form: "tablet",
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
    const user = userEvent.setup();
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
    expect(mockApi.addMedication).toHaveBeenCalledWith({
      name: "Amoxicillin", dose: "250", unit: "mg", form: "syrup", frequency: "three times a day", startDate: "2026-10-01", endDate: "", notes: "",
    });
    expect(within(await item("Amoxicillin")).getByText("250 mg syrup · three times a day")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Add a medication" })).not.toBeInTheDocument();
  });

  test("explains what's wrong instead of saving an invalid medication", async () => {
    const user = userEvent.setup();
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
    const user = userEvent.setup();
    mockApi.addMedication.mockRejectedValueOnce(new Error("Too many changes in a short time. Please wait a few minutes and try again."));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Add medication" }));
    await user.type(screen.getByLabelText("Medication name"), "Aspirin");
    await user.click(screen.getByRole("button", { name: "Save medication" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many changes in a short time.");
  });

  test("edits a medication", async () => {
    const user = userEvent.setup();
    seed({ name: "Paracetamol" });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit Paracetamol" }));

    const form = screen.getByRole("form", { name: "Edit Paracetamol" });
    expect(within(form).getByLabelText("Dose")).toHaveValue("500");
    await user.clear(within(form).getByLabelText("Dose"));
    await user.type(within(form).getByLabelText("Dose"), "1000");
    await user.click(within(form).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Your changes to Paracetamol were saved.");
    expect(mockApi.updateMedication).toHaveBeenCalledWith("1", expect.objectContaining({ name: "Paracetamol", dose: "1000" }));
    expect(within(await item("Paracetamol")).getByText("1000 mg tablet · twice a day")).toBeInTheDocument();
  });

  test("cancelling an edit keeps the medication as it was", async () => {
    const user = userEvent.setup();
    seed({ name: "Paracetamol" });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Edit Paracetamol" }));
    await user.type(screen.getByLabelText("Dose"), "999");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(within(await item("Paracetamol")).getByText("500 mg tablet · twice a day")).toBeInTheDocument();
    expect(mockApi.updateMedication).not.toHaveBeenCalled();
  });

  test("marks a medication as discontinued and active again", async () => {
    const user = userEvent.setup();
    seed({ name: "Paracetamol" });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Mark as discontinued: Paracetamol" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Paracetamol is marked as discontinued.");
    expect(mockApi.setMedicationStatus).toHaveBeenCalledWith("1", "discontinued");
    expect(within(await item("Paracetamol")).getByText("Discontinued")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark as active again: Paracetamol" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Paracetamol is marked as active again.");
    expect(mockApi.setMedicationStatus).toHaveBeenLastCalledWith("1", "active");
    await waitFor(async () => expect(within(await item("Paracetamol")).getByText("Active")).toBeInTheDocument());
  });

  test("asks for confirmation before deleting, and keeping it changes nothing", async () => {
    const user = userEvent.setup();
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
    const user = userEvent.setup();
    seed({ name: "Paracetamol" });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete Paracetamol" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Yes, delete" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Paracetamol was deleted.");
    expect(mockApi.deleteMedication).toHaveBeenCalledWith("1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByText("No medications yet.")).toBeInTheDocument();
  });

  test("offers to try again when the list can't be loaded", async () => {
    const user = userEvent.setup();
    mockApi.getMedications.mockRejectedValueOnce(new Error("Network down"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your medications.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No medications yet.")).toBeInTheDocument();
  });

  test("has the page title and a Medications link in the header", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "My medications" })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Account" })).getByRole("link", { name: "Medications" })).toHaveAttribute("href", "/medications");
  });

  test("is only shown to signed-in users", () => {
    expect(MedicationsPage.requireSignIn).toBe(true);
  });
});
