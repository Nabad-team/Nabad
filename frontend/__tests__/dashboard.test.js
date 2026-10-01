// Automated tests for the Nabad dashboard page.
// These tests run automatically on every pull request.

import { render, screen, act } from "@testing-library/react";
import DashboardPage from "../pages/dashboard";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import { getMyProfile, updateMyProfile, addLinkedProfile } from "../lib/profileApi";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";

// The profile API is replaced by an in-memory fake of the backend.
jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));

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
    mockStatus = "signedIn";
  });

  test("welcomes the demo user by name", async () => {
    renderDashboard();

    expect(
      await screen.findByText("Welcome, Demo User")
    ).toBeInTheDocument();
  });

  test("welcomes the user by their saved name", async () => {
    const profile = await getMyProfile();
    await updateMyProfile({ ...profile, fullName: "Layla Haddad" });

    renderDashboard();

    expect(
      await screen.findByText("Welcome, Layla Haddad")
    ).toBeInTheDocument();
  });

  test("links to the security settings from the page and the account menu", async () => {
    renderDashboard();
    await screen.findByText("Welcome, Demo User");

    const links = screen.getAllByRole("link", { name: "Security" });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute("href", "/security");
  });

  test("loading ends once the profile is shown", async () => {
    renderDashboard();
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await screen.findByText("Welcome, Demo User");
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  test("greets the signed-in user by the name the backend returns, not a demo name", async () => {
    fakeProfileApi.resetFakeProfiles({ fullName: "Rami Khoury", email: "rami@example.test" });

    renderDashboard();

    expect(await screen.findByText("Welcome, Rami Khoury")).toBeInTheDocument();
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

  test("My Profile link points to /profile", async () => {
    renderDashboard();
    await screen.findByText("Welcome, Demo User");

    expect(
      screen.getByRole("link", { name: "My Profile" })
    ).toHaveAttribute("href", "/profile");
  });
});
