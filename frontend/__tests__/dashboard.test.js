// Automated tests for the Nabad dashboard page.
// These tests run automatically on every pull request.

import { render, screen, act, within } from "@testing-library/react";
import DashboardPage from "../pages/dashboard";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import { getMyProfile, updateMyProfile, addLinkedProfile } from "../lib/profileApi";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";
import * as fakeWellbeing from "../test-utils/fakeWellbeingApi";
import { todayString } from "../lib/dates";

// The profile API is replaced by an in-memory fake of the backend.
jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
// The Water and sleep card reads today from an in-memory fake too.
jest.mock("../lib/wellbeingApi", () => require("../test-utils/fakeWellbeingApi"));

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
    <ActiveProfileProvider>
      <DashboardPage />
    </ActiveProfileProvider>
  );
}

describe("Dashboard Page", () => {
  // Start every test signed in, with empty storage and a fresh demo user on the fake backend.
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
    fakeWellbeing.resetFakeWellbeing();
    mockStatus = "signedIn";
  });

  test("welcomes the demo user by name", async () => {
    renderDashboard();

    expect(
      await screen.findByText("Welcome, Demo")
    ).toBeInTheDocument();
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

  test("My profile link points to /profile", async () => {
    renderDashboard();
    await screen.findByText("Welcome, Demo");

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

  test("shows today's water and last night's sleep on the Water and sleep card", async () => {
    fakeWellbeing.seedWater("self", todayString(), 3);
    fakeWellbeing.seedSleep("self", todayString(), 7.5, 4);
    renderDashboard();

    const card = await screen.findByRole("region", { name: "Water and sleep" });
    expect(await within(card).findByText("3 glasses today")).toBeInTheDocument();
    expect(within(card).getByText("7.5 hours, slept well")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Open water and sleep" })).toHaveAttribute("href", "/water-and-sleep");
  });

  test("the Water and sleep card shows the goal only when set, and says when sleep isn't logged", async () => {
    fakeWellbeing.seedWater("self", todayString(), 2);
    fakeWellbeing.seedTarget("self", 6);
    renderDashboard();

    const card = await screen.findByRole("region", { name: "Water and sleep" });
    expect(await within(card).findByText("2 of 6 glasses")).toBeInTheDocument();
    expect(within(card).getByText("Not logged yet")).toBeInTheDocument();
  });
});
