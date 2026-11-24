// Automated tests for the Nabad dashboard page.
// These tests run automatically on every pull request.

import { render, screen, act, within, fireEvent } from "@testing-library/react";
import DashboardPage, { greetingFor } from "../pages/dashboard";
// The greeting follows the time of day in Beirut ("Good morning/afternoon/evening, Demo"); the tests build the
// exact text the page shows right now.
const greeting = (name) => `${greetingFor()}, ${name}`;
const ANY_GREETING = /Good (morning|afternoon|evening)/;
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import { AccessibilityProvider } from "../context/AccessibilityContext";
import { getMyProfile, updateMyProfile, addLinkedProfile } from "../lib/profileApi";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";
import * as fakeWellbeing from "../test-utils/fakeWellbeingApi";
import * as fakeHealth from "../test-utils/fakeHealthProfileApi";
import * as fakeMedications from "../test-utils/fakeMedicationApi";
import * as fakeAppointments from "../test-utils/fakeAppointmentApi";
import { todayString } from "../lib/dates";
import { setMedicationTaken } from "../lib/medicationApi";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

// Full-page flows: slow under load for a good reason (see test-utils/timeouts.js).
jest.setTimeout(PAGE_FLOW_TIMEOUT);

// The profile API is replaced by an in-memory fake of the backend.
jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
// The Water and sleep card reads today from an in-memory fake too.
jest.mock("../lib/wellbeingApi", () => require("../test-utils/fakeWellbeingApi"));
// So does the My health card.
jest.mock("../lib/healthProfileApi", () => require("../test-utils/fakeHealthProfileApi"));
jest.mock("../lib/medicationApi", () => ({ ...require("../test-utils/fakeMedicationApi"), setMedicationTaken: jest.fn() }));
jest.mock("../lib/appointmentApi", () => require("../test-utils/fakeAppointmentApi"));
// A fixed "today", so a run that crosses midnight can't have the card and the test disagree on the date.
jest.mock("../lib/dates", () => ({ ...jest.requireActual("../lib/dates"), todayString: () => "2026-10-12" }));

// The sign-in state the profile provider sees; tests can change it.
let mockStatus = "signedIn";
jest.mock("../components/SessionTimeout", () => ({
  ...jest.requireActual("../components/SessionTimeout"),
  useSessionStatus: () => mockStatus,
  useSignedIn: () => mockStatus === "signedIn",
}));

// The dashboard reads the active profile from the provider, just like in _app.js.
function renderDashboard() {
  return render(
    <AccessibilityProvider>
      <ActiveProfileProvider>
        <DashboardPage />
      </ActiveProfileProvider>
    </AccessibilityProvider>
  );
}

describe("Dashboard Page", () => {
  // Start every test signed in, with empty storage and a fresh demo user on the fake backend.
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
    fakeWellbeing.resetFakeWellbeing();
    fakeHealth.resetFakeHealth();
    fakeMedications.resetFakeMedications();
    setMedicationTaken.mockReset().mockImplementation(fakeMedications.setMedicationTaken);
    fakeAppointments.resetFakeAppointments();
    mockStatus = "signedIn";
  });

  test("greets the demo user by name, with the time of day", async () => {
    renderDashboard();

    expect(
      await screen.findByText(greeting("Demo"))
    ).toBeInTheDocument();
  });

  test("doesn't repeat the menu as a second set of section tiles", async () => {
    renderDashboard();
    await screen.findByText(greeting("Demo"));
    expect(screen.queryByRole("heading", { name: "Explore your health space" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Dashboard sections" })).not.toBeInTheDocument();
  });

  test("Your health: one grid of tiles (former Getting started, Your progress and Quick actions), each tile one link", async () => {
    renderDashboard();
    const section = await screen.findByRole("region", { name: "Your health" });
    const tiles = within(section).getAllByRole("link");
    expect(tiles.map((link) => link.getAttribute("href"))).toEqual([
      "/my-health", "/medications", "/appointments", "/vitals", "/medical-documents", "/symptoms", "/emergency-card",
    ]);
    // Said once: the old Quick actions and Your progress sections are gone.
    expect(screen.queryByRole("navigation", { name: "Quick actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your progress" })).not.toBeInTheDocument();
    expect(within(section).queryByRole("link", { name: "Medication overview" })).not.toBeInTheDocument();
    expect(within(section).queryByRole("link", { name: "Prepare for a visit" })).not.toBeInTheDocument();
    // Equal tiles: an icon, a title and ONE status line; the whole tile is the link, with no button inside.
    for (const link of tiles) {
      expect(link).toHaveClass("tile");
      expect(link.querySelector("svg.held-icon")).not.toBeNull();
      expect(link.querySelectorAll(".tile__title")).toHaveLength(1);
      expect(link.querySelectorAll(".tile__status")).toHaveLength(1);
      expect(link.querySelector("a, button, .button")).toBeNull();
    }
    expect(within(section).getByRole("link", { name: /^Vitals Log a reading/ })).toHaveAttribute("href", "/vitals");
    expect(within(section).getByRole("link", { name: /^Documents Upload or view/ })).toHaveAttribute("href", "/medical-documents");
  });

  test("welcomes the user by their saved name", async () => {
    const profile = await getMyProfile();
    await updateMyProfile({ ...profile, fullName: "Layla Haddad" });

    renderDashboard();

    expect(
      await screen.findByText(greeting("Layla"))
    ).toBeInTheDocument();
  });

  test("greets the user by first name only", async () => {
    renderDashboard();

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(greeting("Demo"));
    expect(screen.queryByText(`${greetingFor()}, Demo User`)).not.toBeInTheDocument();
  });

  test("links to the security settings once, from the account menu", async () => {
    renderDashboard();
    await screen.findByText(greeting("Demo"));
    expect(screen.queryByRole("link", { name: "Account security" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const links = screen.getAllByRole("link", { name: "Account security" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/security");
  });

  test("keeps the picture controls on the profile page, not the dashboard", async () => {
    renderDashboard();
    await screen.findByText(greeting("Demo"));

    expect(screen.queryByRole("button", { name: "Upload picture" })).not.toBeInTheDocument();
  });

  test("loading ends once the profile is shown", async () => {
    renderDashboard();
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await screen.findByText(greeting("Demo"));
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  test("greets the signed-in user by the name the backend returns, not a demo name", async () => {
    fakeProfileApi.resetFakeProfiles({ fullName: "Rami Khoury", email: "rami@example.test" });

    renderDashboard();

    expect(await screen.findByText(greeting("Rami"))).toBeInTheDocument();
    expect(screen.queryByText(/Demo User/)).not.toBeInTheDocument();
  });

  test("does not load any profile while signed out", async () => {
    mockStatus = "signedOut";

    renderDashboard();
    await act(async () => {});

    expect(fakeProfileApi.profileLoads).toBe(0);
    expect(screen.queryByText(ANY_GREETING)).not.toBeInTheDocument();
  });

  test("forgets the profiles after signing out", async () => {
    const child = await addLinkedProfile({ fullName: "Sami", dateOfBirth: "2015-03-10", relationship: "child" });
    localStorage.setItem("nabad-active-profile-id", child.id);
    const { rerender } = renderDashboard();
    await screen.findByText(greeting("Sami"));

    mockStatus = "ended";
    rerender(
      <ActiveProfileProvider>
        <DashboardPage />
      </ActiveProfileProvider>
    );

    await act(async () => {});
    expect(screen.queryByText(ANY_GREETING)).not.toBeInTheDocument();
    expect(localStorage.getItem("nabad-active-profile-id")).toBeNull();
  });

  test("loading ends with an error message when the profile cannot be loaded", async () => {
    fakeProfileApi.failFakeLoading();

    renderDashboard();

    expect(
      await screen.findByText("Could not load your profile. Please refresh the page.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  test("welcomes the active dependent when one is selected", async () => {
    const child = await addLinkedProfile({ fullName: "Sami", dateOfBirth: "2015-03-10", relationship: "child" });
    localStorage.setItem("nabad-active-profile-id", child.id);

    renderDashboard();

    expect(await screen.findByText(greeting("Sami"))).toBeInTheDocument();
    // The "managing ... care" note belongs to /profile only.
    expect(screen.queryByText(/You're managing/)).not.toBeInTheDocument();
  });

  test("account menu contains the account links", async () => {
    renderDashboard();
    await screen.findByText(greeting("Demo"));

    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(
      screen.getByRole("link", { name: "My profile" })
    ).toHaveAttribute("href", "/profile");
  });

  test("offers to check how you're feeling by typing or by speaking", async () => {
    renderDashboard();
    await screen.findByText(greeting("Demo"));

    expect(screen.getByRole("heading", { name: "Something feels off?" })).toBeInTheDocument();
    expect(screen.getByText("Answer a few questions. We'll tell you where to go.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Check a symptom" })
    ).toHaveAttribute("href", "/symptoms");
    // Speak opens the symptoms page already listening.
    expect(
      screen.getByRole("link", { name: "Speak your symptoms" })
    ).toHaveAttribute("href", "/symptoms?voice=1");
  });

  test("simplified mode keeps the same names as the page titles", async () => {
    localStorage.setItem(
      "nabad-accessibility-preferences",
      JSON.stringify({ simplifiedMode: true })
    );

    renderDashboard();

    expect(await screen.findByRole("heading", { name: "Something feels off?" })).toBeInTheDocument();
    expect(screen.getByText("Choose how to tell us.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const accountMenu = document.getElementById("account-menu");
    expect(within(accountMenu).getByRole("link", { name: "My profile" })).toHaveTextContent("My profile");
    expect(within(accountMenu).getByRole("link", { name: "Account security" })).toHaveTextContent("Account security");
  });

  test("shows today's water and sleep once, in Your day, and links to them", async () => {
    fakeWellbeing.seedWater("self", todayString(), [250, 500, 500]);
    fakeWellbeing.seedSleep("self", todayString(), 7.5, 4);
    renderDashboard();

    const day = await screen.findByRole("region", { name: "Your day" });
    // Two meters in one card. No goal: the litres alone and no bar; sleep on its 0 to 12 hour bar.
    const water = await within(day).findByRole("link", { name: "Water 1.25 L today" });
    expect(water).toHaveAttribute("href", "/water-and-sleep");
    expect(water.querySelector(".day-meter__bar")).toBeNull();
    const sleep = within(day).getByRole("link", { name: "Sleep 7.5 hours" });
    expect(sleep).toHaveAttribute("href", "/water-and-sleep");
    expect(sleep.querySelector(".day-meter__bar > span")).toHaveStyle({ width: "63%" });
    expect(within(day).queryByRole("img", { name: /Water today/ })).not.toBeInTheDocument();
    // Said once: Your health has no water or sleep tile repeating them.
    const health = await screen.findByRole("region", { name: "Your health" });
    expect(health).not.toHaveTextContent(/1\.25 L|7\.5 hours|Water|Sleep/);
    expect(within(health).getByRole("link", { name: /^My health/ })).toHaveAttribute("href", "/my-health");
  });

  test("Your day keeps not logged apart from zero", async () => {
    fakeWellbeing.seedWater("self", todayString(), 900);
    fakeWellbeing.seedGoal("self", { type: "atMost", ml: 1500 });
    renderDashboard();

    const day = await screen.findByRole("region", { name: "Your day" });
    // A limit: "0.9 of 1.5 L limit" with the bar toward it.
    const water = await within(day).findByRole("link", { name: "Water 0.9 of 1.5 L limit" });
    expect(water.querySelector(".day-meter__bar > span")).toHaveStyle({ width: "60%" });
    expect(within(day).getByRole("link", { name: "Sleep Not logged" }).querySelector(".day-meter__bar")).toBeNull();
  });

  test("the My health tile counts the basics gently and links to My health", async () => {
    fakeHealth.seedFact("self", "sex", "female");
    fakeHealth.seedFact("self", "bloodType", "unknown");
    renderDashboard();

    const section = await screen.findByRole("region", { name: "Your health" });
    const tile = within(section).getByRole("link", { name: /^My health/ });
    expect(within(tile).getByText("2 of 5 basics")).toBeInTheDocument();
    expect(tile).toHaveAttribute("href", "/my-health");
  });

  test("the My health tile follows the active profile", async () => {
    const child = await addLinkedProfile({ fullName: "Sami Haddad", dateOfBirth: "2018-04-02", relationship: "child" });
    fakeHealth.seedAge(child.id, "2018-04-02", 8);
    localStorage.setItem("nabad-active-profile-id", child.id);
    renderDashboard();

    const section = await screen.findByRole("region", { name: "Your health" });
    const tile = within(section).getByRole("link", { name: /^My health for Sami/ });
    expect(within(tile).getByText("1 of 5 basics")).toBeInTheDocument();
    expect(fakeHealth.calls).toContainEqual(["getHealthProfile", child.id]);
  });

  test("the Next step card sits under the title and the symptom card, and loads the data only once", async () => {
    renderDashboard();
    const card = await screen.findByRole("region", { name: "Next step" });
    // The demo user has health basics left to fill in (and no dose or visit coming up).
    expect(card).toHaveTextContent("Add your health basics for safer guidance");
    expect(within(card).getByRole("link", { name: "Open my health" })).toHaveAttribute("href", "/my-health");
    const title = screen.getByRole("heading", { level: 1 });
    const symptomCard = screen.getByRole("heading", { name: "Something feels off?" });
    expect(title.compareDocumentPosition(symptomCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(symptomCard.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The card and Your health share one set of requests.
    await screen.findByText("0 of 5 basics");
    expect(fakeHealth.calls.filter(([name]) => name === "getHealthProfile")).toHaveLength(1);
  });

  test("the Next step card follows the Acting for profile", async () => {
    const child = await addLinkedProfile({ fullName: "Sami Haddad", dateOfBirth: "2018-04-02", relationship: "child" });
    fakeHealth.seedAge(child.id, "2018-04-02", 8);
    localStorage.setItem("nabad-active-profile-id", child.id);
    renderDashboard();
    const card = await screen.findByRole("region", { name: "Next step" });
    expect(card).toHaveTextContent("Add Sami's health basics for safer guidance");
  });

  test("Your health records the next medicine as taken today, without a checklist", async () => {
    fakeMedications.seedMedication("self", { id: "aspirin", name: "Aspirin", dose: "81", unit: "mg" });
    fakeMedications.seedMedication("self", { id: "vitamin", name: "Vitamin D", taken: true });
    renderDashboard();

    const card = await screen.findByRole("region", { name: "Your health" });
    // The tile says what's next; the count ("1 of 2") is said once, in Your day.
    // The count is said once, on the Medicines tile (Your day has water and sleep only).
    expect(await within(card).findByRole("link", { name: /^Medicines 1 of 2 taken today/ })).toHaveAttribute("href", "/medications");
    expect(within(screen.getByRole("region", { name: "Your day" })).queryByText(/Medicines/)).toBeNull();
    expect(await within(card).findByRole("button", { name: "Mark taken: Aspirin" })).toBeInTheDocument();
    expect(within(card).queryByRole("heading", { name: "Medication check-in" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("checkbox")).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(within(card).getByRole("button", { name: "Mark taken: Aspirin" })); });
    expect(await within(card).findByRole("button", { name: "Undo taken: Aspirin" })).toBeInTheDocument();
    expect(fakeMedications.calls).toContainEqual(["setMedicationTaken", "self", "aspirin", "2026-10-12", true]);
  });

  test("the dashboard reminds me of my next upcoming doctor's appointment", async () => {
    fakeAppointments.seedAppointment("self", { title: "Annual check-up", hospital: "North Clinic", appointmentDate: "2099-04-15", appointmentTime: "09:30" });
    fakeAppointments.seedAppointment("self", { title: "Eye exam", hospital: "Eye Center", appointmentDate: "2099-01-12", appointmentTime: "11:00" });
    renderDashboard();

    const card = await screen.findByRole("region", { name: "Your health" });
    const tile = await within(card).findByRole("link", { name: /^Appointments Eye exam/ });
    expect(tile).toHaveTextContent("Eye exam · 12 January 2099 at 11:00, Eye Center");
    expect(within(card).queryByText(/Annual check-up/)).not.toBeInTheDocument();
    expect(tile).toHaveAttribute("href", "/appointments");
  });

  test("the medication ring updates before saving finishes and rolls back on failure", async () => {
    fakeMedications.seedMedication("self", { id: "aspirin", name: "Aspirin" });
    let rejectSave;
    setMedicationTaken.mockImplementation(() => new Promise((resolve, reject) => { rejectSave = reject; }));
    renderDashboard();
    const button = await screen.findByRole("button", { name: "Mark taken: Aspirin" });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Undo taken: Aspirin" })).toBeDisabled();
    expect(screen.getByText("All taken today")).toBeInTheDocument();
    fireEvent.click(button);
    expect(setMedicationTaken).toHaveBeenCalledTimes(1);
    await act(async () => { rejectSave(new Error("Offline")); });
    expect(screen.getByRole("button", { name: "Mark taken: Aspirin" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("couldn't update today's medication check-in");
  });

  test("is short: the Wellbeing Corner is one compact card, and 140 shows once besides the footer", async () => {
    renderDashboard();
    await screen.findByText(greeting("Demo"));
    const corner = screen.getByRole("region", { name: "Wellbeing" });
    // Today's message and both numbers stay visible; tips and notes are under More.
    expect(within(corner).getByRole("link", { name: "Call 1564" })).toHaveAttribute("href", "tel:1564");
    expect(within(corner).getByRole("link", { name: "Call 140" })).toHaveAttribute("href", "tel:140");
    const more = corner.querySelector("details.wellbeing-corner__more");
    expect(more).not.toHaveAttribute("open");
    expect(within(more).getByText("Simple wellbeing tips")).toBeInTheDocument();
    // The self-harm result's "View mental health support" link still lands on this card.
    expect(document.getElementById("wellbeing-corner-heading")).toBe(within(corner).getByRole("heading", { level: 2 }));
    const main = document.querySelector("main");
    const footer = document.querySelector("footer");
    const visibleText = [...main.querySelectorAll("*")].filter((el) => !el.closest("details:not([open]) > :not(summary)") && !footer?.contains(el) && el.children.length === 0).map((el) => el.textContent).join(" ");
    expect(visibleText.match(/\b140\b/g)).toHaveLength(1);
  });

  // Say each thing once: before phase 3 a new account's phone dashboard had 19 buttons (outlined buttons, button links
  // and disclosures) in main; the target was at least 12 fewer. Tiles, rows and the breathing row are plain links.
  test("the dashboard has at most 7 buttons, and none inside a tile", async () => {
    fakeMedications.seedMedication("self", { id: "aspirin", name: "Aspirin" });
    renderDashboard();
    await screen.findByRole("region", { name: "Your health" });
    await screen.findByRole("button", { name: "Mark taken: Aspirin" });
    const main = document.querySelector("main");
    const buttons = [...main.querySelectorAll("button, summary, a.button, [role='button']")];
    expect(buttons.length).toBeLessThanOrEqual(7);
    expect(main.querySelectorAll(".tile button, .tile .button, .tile summary")).toHaveLength(0);
  });

  test("the Held mark appears once besides the logo: on the symptom card", async () => {
    renderDashboard();
    await screen.findByRole("region", { name: "Your health" });
    const marks = [...document.querySelectorAll("svg.held")];
    expect(marks).toHaveLength(1);
    expect(marks[0].closest(".symptom-card")).not.toBeNull();
    // Breathing is the dot alone (not a mark), in the Wellbeing Corner only.
    expect(document.querySelectorAll("svg.breathing-dot")).toHaveLength(1);
    expect(document.querySelector("svg.breathing-dot").closest("#wellbeing-corner-heading ~ *, .wellbeing-corner")).not.toBeNull();
  });

  // Rows are always full: six regular tiles in an even grid (2 on phones, 3 from 40rem), then the Emergency card as
  // one full-width special tile (Held refresh, phase 3.1).
  test("Your health: six regular tiles in an even grid, then the full-width Emergency card tile", async () => {
    renderDashboard();
    const section = await screen.findByRole("region", { name: "Your health" });
    const items = [...section.querySelectorAll("ul.tile-grid > li")];
    const regular = items.filter((item) => !item.classList.contains("tile-grid__item--wide"));
    expect(regular.map((item) => item.querySelector(".tile__title").textContent)).toEqual(["My health", "Medicines", "Appointments", "Vitals", "Documents", "Symptom checks"]);
    expect(regular.length % 2).toBe(0);
    expect(regular.length % 3).toBe(0);
    const wide = items.filter((item) => item.classList.contains("tile-grid__item--wide"));
    expect(wide).toHaveLength(1);
    expect(items.at(-1)).toBe(wide[0]);
    const emergency = within(wide[0]).getByRole("link");
    expect(emergency).toHaveAttribute("href", "/emergency-card");
    expect(emergency).toHaveClass("tile", "tile--emergency");
    expect(emergency.querySelector(".tile__title")).toHaveTextContent(/^Emergency card$/);
    expect(emergency.querySelector(".tile__status")).toHaveTextContent(/^Your key info for a doctor, even offline/);
    // Every icon sits in its own small square; status lines wrap instead of being cut off.
    for (const tile of section.querySelectorAll(".tile")) expect(tile.querySelector(".tile__icon > svg.held-icon")).not.toBeNull();
    const fs = require("fs"); const path = require("path");
    const css = fs.readFileSync(path.join(__dirname, "../styles/components.css"), "utf8");
    expect(css).toMatch(/\.tile-grid \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    expect(css).toMatch(/@media \(min-width: 40rem\) \{ \.tile-grid \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \} \}/);
    expect(css).toMatch(/\.tile-grid__item--wide \{ grid-column: 1 \/ -1; \}/);
    expect(css).not.toMatch(/\.tile__status \{[^}]*(ellipsis|nowrap)/);
  });
});
