// SCRUM-146: "As a user, I want to upload a photo of a prescription so that my medication list updates
// automatically." The review step on the Medications page, and the helpers that prepare the upload.
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PrescriptionScan from "../components/PrescriptionScan";
import { readPrescription, applyPrescription } from "../lib/prescriptionApi";

jest.mock("../lib/prescriptionApi", () => ({
  ...jest.requireActual("../lib/prescriptionApi"),
  readPrescription: jest.fn(),
  applyPrescription: jest.fn(),
}));
jest.mock("../lib/dates", () => ({ ...jest.requireActual("../lib/dates"), todayString: () => "2026-11-11" }));

const READ = {
  unreadable: "the doctor's signature",
  medications: [
    { name: "Amoxicillin", dose: "500", unit: "mg", form: "tablet", frequency: "three times a day", durationDays: 7, notes: "after food", needsCheck: false,
      match: { status: "changed", existingId: "old-amox", changes: ["dose"], current: { dose: "250", unit: "mg", form: "tablet", frequency: "three times a day" } } },
    { name: "Ventolin", dose: "100", unit: "mcg", form: "inhaler", frequency: "when needed", durationDays: null, notes: "", needsCheck: false, match: { status: "new" } },
    { name: "Panadol", dose: "1", unit: "g", form: "other", frequency: "when needed", durationDays: null, notes: "", needsCheck: false, match: { status: "already-listed", existingId: "p1" } },
    { name: "Zyrtec", dose: "", unit: "", form: "tablet", frequency: "once a day", durationDays: 5, notes: "", needsCheck: true, match: { status: "new" } },
  ],
};
const photo = () => new File([new Uint8Array([137, 80, 78, 71])], "rx.png", { type: "image/png" });

function setup() {
  const onDone = jest.fn();
  const onCancel = jest.fn();
  const user = userEvent.setup({ delay: null });
  render(<PrescriptionScan profileId="self" listName="your list" onDone={onDone} onCancel={onCancel} />);
  return { user, onDone, onCancel };
}
async function readIt(user) {
  await user.upload(screen.getByLabelText("Prescription photo or PDF"), photo());
  await user.click(screen.getByRole("checkbox", { name: /I agree to send this prescription/ }));
  await user.click(screen.getByRole("button", { name: "Read prescription" }));
  return screen.findByRole("list", { name: "Medicines found on the prescription" });
}
const card = (list, name) => within(list).getByDisplayValue(name).closest("li");

beforeEach(() => {
  jest.clearAllMocks();
  readPrescription.mockResolvedValue(READ);
  applyPrescription.mockResolvedValue({ added: [{ id: "a" }, { id: "b" }], replaced: [{ id: "old-amox", name: "Amoxicillin" }] });
});

test("asks for a photo and for consent before anything is sent", async () => {
  const { user } = setup();
  await user.click(screen.getByRole("button", { name: "Read prescription" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a photo of the prescription first.");
  await user.upload(screen.getByLabelText("Prescription photo or PDF"), photo());
  await user.click(screen.getByRole("button", { name: "Read prescription" }));
  expect(screen.getByRole("alert")).toHaveTextContent("agree to send the photo");
  expect(readPrescription).not.toHaveBeenCalled();
});

test("refuses a file type the server can't read", async () => {
  setup();
  const input = screen.getByLabelText("Prescription photo or PDF");
  expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp,application/pdf");
  fireEvent.change(input, { target: { files: [new File(["x"], "rx.gif", { type: "image/gif" })] } });
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a JPG, PNG or WebP photo, or a PDF");
});

test("fills in what was read, ticks new and changed medicines, and leaves out what is already listed or unclear", async () => {
  const { user } = setup();
  const list = await readIt(user);
  expect(readPrescription).toHaveBeenCalledWith("self", expect.any(File), expect.any(AbortSignal));
  expect(screen.getByText(/Some parts couldn't be read: the doctor's signature/)).toBeInTheDocument();

  const amox = card(list, "Amoxicillin");
  expect(within(amox).getByText("Changed")).toBeInTheDocument();
  expect(amox).toHaveTextContent("On your list now: 250 mg, tablet, three times a day. Adding this replaces it");
  expect(within(amox).getByRole("checkbox", { name: "Replace with this prescription" })).toBeChecked();
  expect(within(amox).getByLabelText("Dose")).toHaveValue("500");
  expect(amox).toHaveTextContent("Instructions: after food");
  expect(amox).toHaveTextContent("For 7 days: until");

  expect(within(card(list, "Ventolin")).getByRole("checkbox", { name: "Add this medicine" })).toBeChecked();
  const panadol = card(list, "Panadol");
  expect(within(panadol).getByText("Already on your list")).toBeInTheDocument();
  expect(within(panadol).getByRole("checkbox")).not.toBeChecked();
  const zyrtec = card(list, "Zyrtec");
  expect(within(zyrtec).getByText("Check this")).toBeInTheDocument();
  expect(within(zyrtec).getByRole("checkbox")).not.toBeChecked();

  expect(screen.getByRole("button", { name: "Add 2 medicines to your list" })).toBeInTheDocument();
});

test("adds the ticked medicines with the person's corrections, the start date and each end date", async () => {
  const { user, onDone } = setup();
  const list = await readIt(user);
  const zyrtec = card(list, "Zyrtec");
  await user.type(within(zyrtec).getByLabelText("Dose"), "10");
  await user.type(within(zyrtec).getByLabelText("Unit"), "mg");
  await user.click(within(zyrtec).getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Add 3 medicines to your list" }));

  expect(applyPrescription).toHaveBeenCalledWith("self", [
    { name: "Amoxicillin", dose: "500", unit: "mg", form: "tablet", frequency: "three times a day", startDate: "2026-11-11", endDate: "2026-11-17", notes: "after food", replaceId: "old-amox" },
    { name: "Ventolin", dose: "100", unit: "mcg", form: "inhaler", frequency: "when needed", startDate: "2026-11-11", endDate: "", notes: "" },
    { name: "Zyrtec", dose: "10", unit: "mg", form: "tablet", frequency: "once a day", startDate: "2026-11-11", endDate: "2026-11-15", notes: "" },
  ]);
  await waitFor(() => expect(onDone).toHaveBeenCalledWith("2 medicines were added to your list from the prescription, replacing 1 older entry (kept under Discontinued)."));
});

test("a medicine without a name can't be added; nothing ticked means nothing to add", async () => {
  const { user } = setup();
  const list = await readIt(user);
  await user.clear(within(card(list, "Ventolin")).getByLabelText("Medication name"));
  await user.click(screen.getByRole("button", { name: "Add 2 medicines to your list" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a name for every medicine you are adding");
  expect(applyPrescription).not.toHaveBeenCalled();
  for (const box of within(list).getAllByRole("checkbox")) if (box.checked) await user.click(box);
  expect(screen.getByRole("button", { name: "Tick the medicines to add" })).toBeDisabled();
});

test("shows the server's message when reading or saving fails, and lets the person try again", async () => {
  readPrescription.mockRejectedValueOnce(Object.assign(new Error("No medicine names could be read clearly. Try a sharper photo in good light, or add your medicines by hand."), { status: 422 }));
  const { user } = setup();
  await user.upload(screen.getByLabelText("Prescription photo or PDF"), photo());
  await user.click(screen.getByRole("checkbox", { name: /I agree/ }));
  await user.click(screen.getByRole("button", { name: "Read prescription" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No medicine names could be read clearly");
  applyPrescription.mockRejectedValueOnce(new Error("Amoxicillin: the medication it replaces is no longer active on the list. Read the prescription again."));
  await user.click(screen.getByRole("button", { name: "Read prescription" }));
  await screen.findByRole("list", { name: "Medicines found on the prescription" });
  await user.click(screen.getByRole("button", { name: "Add 2 medicines to your list" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("no longer active on the list");
  expect(screen.getByRole("button", { name: "Add 2 medicines to your list" })).toBeEnabled();
});

test("cancel closes it without saving", async () => {
  const { user, onCancel } = setup();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onCancel).toHaveBeenCalled();
  expect(applyPrescription).not.toHaveBeenCalled();
});

describe("preparing the upload", () => {
  const { endDateFor, shrinkPhoto } = jest.requireActual("../lib/prescriptionApi");
  test("the end date is the last day of the course", () => {
    expect(endDateFor("2026-11-11", 7)).toBe("2026-11-17");
    expect(endDateFor("2026-11-30", 2)).toBe("2026-12-01");
    expect(endDateFor("2026-11-11", 1)).toBe("2026-11-11");
    expect(endDateFor("2026-11-11", null)).toBe("");
    expect(endDateFor("", 7)).toBe("");
  });
  test("a small photo or a PDF is sent as it is", async () => {
    const small = photo();
    expect(await shrinkPhoto(small)).toBe(small);
    const pdf = new File(["%PDF-1.4"], "rx.pdf", { type: "application/pdf" });
    expect(await shrinkPhoto(pdf)).toBe(pdf);
  });
});
