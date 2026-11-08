// SCRUM-150: the medication overview page (everyone's medications on one page) and its filter logic.
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MedicationOverviewPage from "../pages/medication-overview";
import { filterOverview, medicationFlags, medicationSummary, overviewTotals, totalsSentence } from "../lib/medicationOverview";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

jest.setTimeout(PAGE_FLOW_TIMEOUT);

const mockSwitchProfile = jest.fn();
jest.mock("../context/ActiveProfileContext", () => ({ useActiveProfile: () => ({ switchProfile: mockSwitchProfile }) }));
jest.mock("../components/ProfileHeader", () => () => null);
const mockGetOverview = jest.fn();
jest.mock("../lib/medicationOverview", () => ({
  ...jest.requireActual("../lib/medicationOverview"),
  getMedicationOverview: (...args) => mockGetOverview(...args),
}));

const NO_FLAGS = { missingDose: false, missingSchedule: false, changedRecently: false };
const med = (fields) => ({ id: fields.name, dose: "500", unit: "mg", form: "tablet", frequency: "twice a day", times: [], status: "active",
  startDate: "2026-09-01", endDate: "", updatedAt: "2026-10-01T09:30:00.000Z", ...fields, flags: { ...NO_FLAGS, ...fields.flags } });
function person(id, name, medications) {
  const active = medications.filter((m) => m.status === "active");
  return {
    id, name, isSelf: id === "self", relationship: id === "self" ? null : "other", medications,
    counts: { active: active.length, discontinued: medications.length - active.length },
    flags: { noMedications: medications.length === 0, missingDetails: active.filter((m) => m.flags.missingDose || m.flags.missingSchedule).length, changedRecently: medications.filter((m) => m.flags.changedRecently).length },
  };
}
const layla = person("self", "Layla", []);
const amal = person("a1", "Amal Haddad", [
  med({ name: "Metformin", times: ["08:00", "20:00"] }),
  med({ name: "Warfarin", dose: "", unit: "", flags: { missingDose: true, changedRecently: true } }),
  med({ name: "Aspirin", status: "discontinued" }),
]);
const omar = person("o1", "Omar Khoury", [med({ name: "Insulin", frequency: "", flags: { missingSchedule: true } })]);
const salma = person("s1", "Salma", [med({ name: "Old cream", status: "discontinued" })]);
const PROFILES = [layla, amal, omar, salma];
const overview = (profiles = PROFILES) => ({ generatedAt: "2026-11-08T10:00:00.000Z", recentChangeDays: 7, profiles });

beforeEach(() => { mockSwitchProfile.mockReset(); mockGetOverview.mockReset(); });

describe("filterOverview", () => {
  const names = (visible) => visible.map(({ profile, medications }) => `${profile.name}: ${medications.map((m) => m.name).join(",")}`);

  test("shows everyone with active medications only by default", () => {
    expect(names(filterOverview(PROFILES))).toEqual(["Layla: ", "Amal Haddad: Metformin,Warfarin", "Omar Khoury: Insulin", "Salma: "]);
  });
  test("includes discontinued medications when asked", () => {
    expect(names(filterOverview(PROFILES, { showDiscontinued: true }))[1]).toBe("Amal Haddad: Metformin,Warfarin,Aspirin");
  });
  test("a person's name keeps all their medications; a medication name keeps only the matches", () => {
    expect(names(filterOverview(PROFILES, { query: " amal " }))).toEqual(["Amal Haddad: Metformin,Warfarin"]);
    expect(names(filterOverview(PROFILES, { query: "WARF" }))).toEqual(["Amal Haddad: Warfarin"]);
    expect(names(filterOverview(PROFILES, { query: "aspirin" }))).toEqual([]);
    expect(names(filterOverview(PROFILES, { query: "aspirin", showDiscontinued: true }))).toEqual(["Amal Haddad: Aspirin"]);
  });
  test("only people with active medications", () => {
    expect(names(filterOverview(PROFILES, { onlyActive: true }))).toEqual(["Amal Haddad: Metformin,Warfarin", "Omar Khoury: Insulin"]);
    expect(names(filterOverview(PROFILES, { onlyActive: true, query: "salma" }))).toEqual([]);
  });
});

test("flags, summary and totals in words", () => {
  expect(medicationFlags(amal.medications[1]).map((f) => f.label)).toEqual(["Missing dose", "Changed in the last 7 days"]);
  expect(medicationFlags(omar.medications[0]).map((f) => [f.label, f.tone])).toEqual([["Missing schedule", "warning"]]);
  expect(medicationFlags(amal.medications[0])).toEqual([]);
  expect(medicationSummary(amal.medications[0])).toBe("500 mg tablet · twice a day · 08:00, 20:00");
  expect(medicationSummary(med({ name: "x", dose: "", unit: "", form: "other", frequency: "" }))).toBe("");
  const totals = overviewTotals(filterOverview(PROFILES, { showDiscontinued: true }));
  expect(totals).toEqual({ people: 4, active: 3, discontinued: 2, needsCheck: 2 });
  expect(totalsSentence(totals, true)).toBe("Showing 4 people, 3 active medications, 2 discontinued, 2 missing a dose or schedule.");
  expect(totalsSentence({ people: 1, active: 1, discontinued: 0, needsCheck: 0 }, false)).toBe("Showing 1 person, 1 active medication.");
});

test("one section per person with headings, flags and an edit link that switches to that person", async () => {
  mockGetOverview.mockResolvedValue(overview());
  render(<MedicationOverviewPage />);
  expect(screen.getByRole("status")).toHaveTextContent(/Loading the medication overview/);

  const amalSection = await screen.findByRole("region", { name: "Amal Haddad" });
  expect(screen.getByRole("heading", { level: 1, name: "Medication overview" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Layla (you)", "Amal Haddad", "Omar Khoury", "Salma"]);
  const list = within(amalSection).getByRole("list", { name: "Medications for Amal Haddad" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  expect(within(amalSection).getByText("Missing dose")).toBeInTheDocument();
  expect(within(amalSection).getByText("Changed in the last 7 days")).toBeInTheDocument();
  expect(within(amalSection).getByText("500 mg tablet · twice a day · 08:00, 20:00")).toBeInTheDocument();
  expect(within(amalSection).queryByText("Aspirin")).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Omar Khoury" })).getByText("Missing schedule")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Layla (you)" })).getByText("No medications recorded")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Salma" })).getByText(/No active medications/)).toBeInTheDocument();
  expect(screen.getByText("Showing 4 people, 3 active medications, 2 missing a dose or schedule.")).toBeInTheDocument();
  // There are linked profiles, so no "how to add one" explanation.
  expect(screen.queryByText("No linked profiles yet")).not.toBeInTheDocument();

  const edit = within(amalSection).getByRole("link", { name: "Edit Amal Haddad's medications" });
  expect(edit).toHaveAttribute("href", "/medications");
  edit.addEventListener("click", (event) => event.preventDefault());
  await userEvent.click(edit);
  expect(mockSwitchProfile).toHaveBeenCalledWith("a1");
  expect(within(screen.getByRole("region", { name: "Layla (you)" })).getByRole("link", { name: "Edit your medications" })).toBeInTheDocument();
});

test("search, discontinued toggle and the active-only filter", async () => {
  const user = userEvent.setup();
  mockGetOverview.mockResolvedValue(overview());
  render(<MedicationOverviewPage />);
  const search = await screen.findByRole("searchbox", { name: "Search by person or medication" });

  await user.type(search, "insulin");
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Omar Khoury"]);
  await user.clear(search);
  await user.type(search, "nobody here");
  expect(screen.getByText("Nobody matches these filters.")).toBeInTheDocument();
  await user.clear(search);

  await user.click(screen.getByRole("checkbox", { name: "Show discontinued medications" }));
  const amalSection = screen.getByRole("region", { name: "Amal Haddad" });
  expect(within(amalSection).getByText("Aspirin")).toBeInTheDocument();
  expect(within(amalSection).getByText("Discontinued")).toBeInTheDocument();

  await user.click(screen.getByRole("checkbox", { name: "Only people with active medications" }));
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Amal Haddad", "Omar Khoury"]);
});

test("explains how to add linked profiles when there are none", async () => {
  mockGetOverview.mockResolvedValue(overview([person("self", "Layla", [med({ name: "Vitamin D" })])]));
  render(<MedicationOverviewPage />);
  expect(await screen.findByText("No linked profiles yet")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "My profile" })).toHaveAttribute("href", "/profile#linked-heading");
  expect(screen.getByText("Vitamin D")).toBeInTheDocument();
});

test("shows an error with a retry, and the print button prints", async () => {
  const user = userEvent.setup();
  mockGetOverview.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(overview());
  render(<MedicationOverviewPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load the medication overview.");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("region", { name: "Amal Haddad" });

  const print = jest.spyOn(window, "print").mockImplementation(() => {});
  await user.click(screen.getByRole("button", { name: "Print for handover" }));
  expect(print).toHaveBeenCalled();
  print.mockRestore();
});

test("an empty overview says so", async () => {
  mockGetOverview.mockResolvedValue(overview([layla, person("x", "Zeina", [])]));
  render(<MedicationOverviewPage />);
  await waitFor(() => expect(screen.getAllByText("No medications recorded")).toHaveLength(2));
});
