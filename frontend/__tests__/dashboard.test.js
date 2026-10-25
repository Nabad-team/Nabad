// Automated tests for the Nabad dashboard page.
// These tests run automatically on every pull request.

import { render, screen, act, within, fireEvent } from "@testing-library/react";
import DashboardPage from "../pages/dashboard";
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

  test("welcomes the demo user by name", async () => {
    renderDashboard();

    expect(
      await screen.findByText("Welcome, Demo")
    ).toBeInTheDocument();
  });

  test("offers medical documents alongside the dashboard section tiles", async () => {
    renderDashboard();
    await screen.findByText("Welcome, Demo");
    const sections = screen.getByRole("region", { name: "Dashboard sections" });
    expect(within(sections).getByRole("link", { name: "Medical documents" })).toHaveAttribute("href", "/medical-documents");
  });

  test("welcomes the user by their saved name", async () => {
    const profile = await getMyProfile();
    await updateMyProfile({ ...profile, fullName: "Layla Haddad" });

    renderDashboard();

    expect(
      await screen.findByText("Welcome, Layla")
    ).toBeInTheDocument();
  });

  test("greets the user by first name only", async () => {
    renderDashboard();

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Welcome, Demo");
    expect(screen.queryByText(/Welcome, Demo User/)).not.toBeInTheDocument();
  });

  test("links to the security settings once, from the account menu", async () => {
    renderDashboard();
    await screen.findByText("Welcome, Demo");
    expect(screen.queryByRole("link", { name: "Security" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const links = screen.getAllByRole("link", { name: "Security" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/security");
  });

  test("keeps the picture controls on the profile page, not the dashboard", async () => {
    renderDashboard();
    await screen.findByText("Welcome, Demo");

    expect(screen.queryByRole("button", { name: "Upload picture" })).not.toBeInTheDocument();
  });

  test("loading ends once the profile is shown", async () => {
    renderDashboard();
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await screen.findByText("Welcome, Demo");
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  test("greets the signed-in user by the name the backend returns, not a demo name", async () => {
    fakeProfileApi.resetFakeProfiles({ fullName: "Rami Khoury", email: "rami@example.test" });

    renderDashboard();

    expect(await screen.findByText("Welcome, Rami")).toBeInTheDocument();
    expect(screen.queryByText(/Demo User/)).not.toBeInTheDocument();
  });

  test("does not load any profile while signed out", async () => {
    mockStatus = "signedOut";

    renderDashboard();
    await act(async () => {});

    expect(fakeProfileApi.profileLoads).toBe(0);
    expect(screen.queryByText(/Welcome/)).not.toBeInTheDocument();
  });

  test("forgets the profiles after signing out", async () => {
    const child = await addLinkedProfile({ fullName: "Sami", dateOfBirth: "2015-03-10", relationship: "child" });
    localStorage.setItem("nabad-active-profile-id", child.id);
    const { rerender } = renderDashboard();
    await screen.findByText("Welcome, Sami");

    mockStatus = "ended";
    rerender(
      <ActiveProfileProvider>
        <DashboardPage />
      </ActiveProfileProvider>
    );

    await act(async () => {});
    expect(screen.queryByText(/Welcome/)).not.toBeInTheDocument();
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

    expect(await screen.findByText("Welcome, Sami")).toBeInTheDocument();
    // The "managing ... care" note belongs to /profile only.
    expect(screen.queryByText(/You're managing/)).not.toBeInTheDocument();
  });

  test("account menu contains the account links", async () => {
    renderDashboard();
    await screen.findByText("Welcome, Demo");

    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(
      screen.getByRole("link", { name: "My profile" })
    ).toHaveAttribute("href", "/profile");
  });

  test("offers to check how you're feeling by typing or by speaking", async () => {
    renderDashboard();
    await screen.findByText("Welcome, Demo");

    expect(screen.getByRole("heading", { name: "Check how you're feeling" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Type your symptoms" })
    ).toHaveAttribute("href", "/symptoms");
    // Speak opens the symptoms page already listening.
    expect(
      screen.getByRole("link", { name: "Speak your symptoms" })
    ).toHaveAttribute("href", "/symptoms?voice=1");
  });

  test("uses short labels in simplified mode while keeping accessible names", async () => {
    localStorage.setItem(
      "nabad-accessibility-preferences",
      JSON.stringify({ simplifiedMode: true })
    );

    renderDashboard();

    expect(await screen.findByRole("heading", { name: "How do you feel?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const accountMenu = document.getElementById("account-menu");
    expect(within(accountMenu).getByRole("link", { name: "Safety check" })).toHaveTextContent("Safety");
    expect(within(accountMenu).getByRole("link", { name: "Medications" })).toHaveTextContent("Medicines");
    expect(within(accountMenu).getByRole("link", { name: "My profile" })).toHaveTextContent("Profile");
  });

  test("shows health, water and sleep progress as rings", async () => {
    fakeWellbeing.seedWater("self", todayString(), [250, 500, 500]);
    fakeWellbeing.seedSleep("self", todayString(), 7.5, 4);
    renderDashboard();

    const card = await screen.findByRole("region", { name: "Your progress" });
    expect(await within(card).findByRole("img", { name: /Water today: No daily goal set\. 1\.25 L logged today/ })).toBeInTheDocument();
    expect(within(card).getByRole("img", { name: /Last night’s sleep: Logged\. Slept well/ })).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Track water" })).toHaveAttribute("href", "/water-and-sleep");
    expect(within(card).getByRole("link", { name: "Log sleep" })).toHaveAttribute("href", "/water-and-sleep");
    expect(within(card).getByRole("link", { name: "Open my health" })).toHaveAttribute("href", "/my-health");
  });

  test("the water ring shows progress against a limit and the sleep ring says when sleep isn't logged", async () => {
    fakeWellbeing.seedWater("self", todayString(), 900);
    fakeWellbeing.seedGoal("self", { type: "atMost", ml: 1500 });
    renderDashboard();

    const card = await screen.findByRole("region", { name: "Your progress" });
    expect(await within(card).findByRole("img", { name: "Water today: Within your limit. 0.9 L of your 1.5 L daily limit." })).toBeInTheDocument();
    expect(within(card).getByRole("img", { name: /Last night’s sleep: Not logged yet/ })).toBeInTheDocument();
  });

  test("the My health card counts the basics gently and links to My health", async () => {
    fakeHealth.seedFact("self", "sex", "female");
    fakeHealth.seedFact("self", "bloodType", "unknown");
    renderDashboard();

    const card = await screen.findByRole("region", { name: "Your progress" });
    expect(await within(card).findByRole("img", { name: "My health: In progress. 2 of 5 health basics filled in." })).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Open my health" })).toHaveAttribute("href", "/my-health");
  });

  test("the My health card follows the active profile", async () => {
    const child = await addLinkedProfile({ fullName: "Sami Haddad", dateOfBirth: "2018-04-02", relationship: "child" });
    fakeHealth.seedAge(child.id, "2018-04-02", 8);
    localStorage.setItem("nabad-active-profile-id", child.id);
    renderDashboard();

    const card = await screen.findByRole("region", { name: "Your progress" });
    expect(await within(card).findByRole("img", { name: "My health: In progress. 1 of 5 health basics filled in for Sami Haddad." })).toBeInTheDocument();
    expect(fakeHealth.calls).toContainEqual(["getHealthProfile", child.id]);
  });

  test("the medication ring records taken today without a checklist below the rings", async () => {
    fakeMedications.seedMedication("self", { id: "aspirin", name: "Aspirin", dose: "81", unit: "mg" });
    fakeMedications.seedMedication("self", { id: "vitamin", name: "Vitamin D", taken: true });
    renderDashboard();

    const card = await screen.findByRole("region", { name: "Your progress" });
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

    const card = await screen.findByRole("region", { name: "Your progress" });
    expect(await within(card).findByText("Eye exam")).toBeInTheDocument();
    expect(within(card).getByText(/Eye Center · 12 January 2099 at 11:00/)).toBeInTheDocument();
    expect(within(card).queryByText("Annual check-up")).not.toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "View appointments" })).toHaveAttribute("href", "/appointments");
  });

  test("the medication ring updates before saving finishes and rolls back on failure", async () => {
    fakeMedications.seedMedication("self", { id: "aspirin", name: "Aspirin" });
    let rejectSave;
    setMedicationTaken.mockImplementation(() => new Promise((resolve, reject) => { rejectSave = reject; }));
    renderDashboard();
    const button = await screen.findByRole("button", { name: "Mark taken: Aspirin" });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Undo taken: Aspirin" })).toBeDisabled();
    expect(screen.getByText("All checked off")).toBeInTheDocument();
    fireEvent.click(button);
    expect(setMedicationTaken).toHaveBeenCalledTimes(1);
    await act(async () => { rejectSave(new Error("Offline")); });
    expect(screen.getByRole("button", { name: "Mark taken: Aspirin" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("couldn't update today's medication check-in");
  });
});
