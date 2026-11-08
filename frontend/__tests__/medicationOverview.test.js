// SCRUM-150: the medication overview page (everyone's medications on one page) and its filter logic.
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MedicationOverviewPage from "../pages/medication-overview";
import fs from "fs";
import path from "path";
import { filterOverview, medicationFlags, medicationDetails, sameNameDetails, overviewTotals, totalsSentence } from "../lib/medicationOverview";
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
  const metformin = within(list).getAllByRole("listitem")[0];
  expect(within(metformin).getByText("Dose").nextSibling).toHaveTextContent("500 mg");
  expect(within(metformin).getByText("Times").nextSibling).toHaveTextContent("08:00, 20:00");
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

// ---- Follow-up: labelled fields, people with the same name, print footer ----------------------------

const pairs = (medication) => medicationDetails(medication).map((d) => `${d.label}: ${d.value}`);

test("every medication field has a label, so no value is a bare number", () => {
  // The case from production: "487 mg injection · 5" showed an unlabelled 5.
  expect(pairs(med({ name: "x", dose: "487", unit: "mg", form: "injection", frequency: "5", times: [], updatedAt: "2026-10-01T09:30:00" }))).toEqual([
    "Dose: 487 mg", "Route / form: Injection", "Frequency: 5", "Started: 1 September 2026", "Last updated: 1 October 2026, 09:30",
  ]);
  expect(pairs(med({ name: "x", dose: "", unit: "mg", frequency: "", times: ["08:00", "20:00"], endDate: "2026-09-30", updatedAt: "2026-10-01T09:30:00" }))).toEqual([
    "Dose: Not recorded", "Route / form: Tablet", "Frequency: Not recorded", "Times: 08:00, 20:00", "Dates: 1 September 2026 to 30 September 2026", "Last updated: 1 October 2026, 09:30",
  ]);
  for (const medication of [...amal.medications, ...omar.medications]) {
    for (const detail of medicationDetails(medication)) expect(detail.label).toMatch(/\w/);
  }
});

test("on the page each value sits under its label (a description list)", async () => {
  mockGetOverview.mockResolvedValue(overview([person("self", "Layla", [med({ name: "Ceftriaxone", dose: "487", unit: "mg", form: "injection", frequency: "5" })])]));
  render(<MedicationOverviewPage />);
  const item = (await screen.findByText("Ceftriaxone")).closest("li");
  const terms = [...item.querySelectorAll("dt")].map((dt) => `${dt.textContent}=${dt.nextElementSibling.textContent}`);
  expect(terms).toEqual(expect.arrayContaining(["Dose=487 mg", "Route / form=Injection", "Frequency=5"]));
  // Every dd follows a dt: no unlabelled value anywhere in the row.
  expect(item.querySelectorAll("dd")).toHaveLength(item.querySelectorAll("dt").length);
  expect(item.querySelectorAll("dd:not(dt + dd)")).toHaveLength(0);
});

describe("people with the same name", () => {
  const twin = (id, relationship, dateOfBirth, addedOn) => ({ ...person(id, "Amal Haddad", []), relationship, dateOfBirth, addedOn });

  test("each gets a distinguishing detail from existing fields; unique names get none", () => {
    const details = sameNameDetails([layla, twin("a1", "other", "1941-02-03", "2026-10-01"), twin("a2", "parent", "1950-07-08", "2026-10-02"), omar]);
    expect([...details.entries()]).toEqual([["a1", "Other, born 3 February 1941"], ["a2", "Parent, born 8 July 1950"]]);
  });

  test("names match ignoring case and extra spaces", () => {
    const details = sameNameDetails([{ ...twin("a1", "other", "1941-02-03"), name: "amal  haddad " }, twin("a2", "other", "1950-07-08")]);
    expect(details.size).toBe(2);
  });

  test("when relationship and birth date are the same too, the date the profile was added tells them apart", () => {
    const details = sameNameDetails([twin("a1", "other", "1941-02-03", "2026-10-01"), twin("a2", "other", "1941-02-03", "2026-10-05")]);
    expect(details.get("a1")).toBe("Other, born 3 February 1941, profile added 1 October 2026");
    expect(details.get("a2")).toBe("Other, born 3 February 1941, profile added 5 October 2026");
  });

  test("never invents a missing date of birth", () => {
    const details = sameNameDetails([{ ...person("self", "Amal Haddad", []), dateOfBirth: "" }, twin("a1", "other", "1941-02-03")]);
    expect(details.get("self")).toBe("You");
    expect(details.get("a1")).toBe("Other, born 3 February 1941");
  });

  test("the page shows the detail in the heading and the check-carefully note, for each of them", async () => {
    mockGetOverview.mockResolvedValue(overview([layla, twin("a1", "other", "1941-02-03", "2026-10-01"), twin("a2", "parent", "1950-07-08", "2026-10-02"), omar]));
    render(<MedicationOverviewPage />);
    const first = await screen.findByRole("region", { name: "Amal Haddad (Other, born 3 February 1941)" });
    const second = screen.getByRole("region", { name: "Amal Haddad (Parent, born 8 July 1950)" });
    for (const section of [first, second]) expect(within(section).getByText("Same name as another person, check carefully")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Omar Khoury" })).queryByText(/Same name/)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Layla (you)" })).toBeInTheDocument();
  });

  test("the note stays when a filter hides the namesake", async () => {
    const user = userEvent.setup();
    mockGetOverview.mockResolvedValue(overview([twin("a1", "other", "1941-02-03"), { ...twin("a2", "parent", "1950-07-08"), medications: [med({ name: "Insulin" })], counts: { active: 1, discontinued: 0 } }]));
    render(<MedicationOverviewPage />);
    await user.click(await screen.findByRole("checkbox", { name: "Only people with active medications" }));
    const only = screen.getByRole("region", { name: "Amal Haddad (Parent, born 8 July 1950)" });
    expect(within(only).getByText("Same name as another person, check carefully")).toBeInTheDocument();
  });
});

describe("print footer", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "styles", "components.css"), "utf8").replace(/\r\n/g, "\n");
  const FOOTER = "Confidential health information. Do not leave unattended.";

  test("the page has the confidentiality footer", async () => {
    mockGetOverview.mockResolvedValue(overview());
    const { container } = render(<MedicationOverviewPage />);
    await screen.findByRole("region", { name: "Amal Haddad" });
    expect(container.querySelector(".overview-print-footer")).toHaveTextContent(FOOTER);
  });

  test("it is hidden on screen and repeated on every printed page", () => {
    // The overview's own rules: screen styles first, then @page and @media print.
    const overviewCss = css.slice(css.indexOf("/* ---------- Medication overview (SCRUM-150)"));
    const [screenRules, printRules] = overviewCss.split("@page medication-overview");
    expect(screenRules).toMatch(/\.overview-print-header,\s*\.overview-print-footer\s*\{\s*display:\s*none;/);
    expect(printRules).toContain(`@bottom-center {\n    content: "${FOOTER}";`);
    expect(printRules).toMatch(/\.overview-print-footer\s*\{\s*display:\s*block;/);
    expect(printRules).toMatch(/body:has\(\.medication-overview\),\s*\.medication-overview\s*\{\s*page:\s*medication-overview;/);
  });
});
