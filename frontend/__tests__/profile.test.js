// Automated tests for the Nabad "My Profile" page.
// These tests run automatically on every pull request.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfilePage from "../pages/profile";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import { getMyProfile, addLinkedProfile, listLinkedProfiles } from "../lib/profileApi";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";

// The profile API is replaced by an in-memory fake of the backend.
jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));

// The profile provider loads profiles only while signed in; here the user is signed in.
jest.mock("../components/SessionTimeout", () => ({
  ...jest.requireActual("../components/SessionTimeout"),
  useSessionStatus: () => "signedIn",
}));

// A fake sign-out, so tests can check where the page goes after deleting the account.
const mockSignOut = jest.fn();
jest.mock("../lib/session", () => ({
  ...jest.requireActual("../lib/session"),
  signOut: (...args) => mockSignOut(...args),
}));

jest.mock("next/router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

// The page reads linked profiles from the provider, just like in _app.js.
function renderProfilePage() {
  render(
    <ActiveProfileProvider>
      <ProfilePage />
    </ActiveProfileProvider>
  );
}

// Renders the page, waits for the profile to load, and clicks "Edit".
async function renderInEditMode() {
  const user = userEvent.setup();
  renderProfilePage();
  await user.click(await screen.findByRole("button", { name: "Edit" }));
  return user;
}

describe("Profile Page", () => {
  // Start every test with empty storage and a fresh demo user on the fake backend.
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
    mockSignOut.mockClear();
  });

  test("shows the user's name and email", async () => {
    renderProfilePage();

    expect(await screen.findByText("Demo User")).toBeInTheDocument();
    expect(screen.getByText("demo@nabad.app")).toBeInTheDocument();
  });

  test("loading ends once the profile is shown", async () => {
    renderProfilePage();
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await screen.findByText("Demo User");
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  test("loading ends with an error message when the profile cannot be loaded", async () => {
    fakeProfileApi.failFakeLoading();

    renderProfilePage();

    expect(
      await screen.findByText("Could not load your profile. Please refresh the page.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  test("shows an error when the name is empty", async () => {
    const user = await renderInEditMode();

    await user.clear(screen.getByLabelText("Full name"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Full name is required")).toBeInTheDocument();
  });

  test("shows an error for an invalid phone number", async () => {
    const user = await renderInEditMode();

    await user.type(screen.getByLabelText("Phone"), "abc123");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("Enter a valid Lebanese or international phone number")
    ).toBeInTheDocument();
  });

  test("shows an error for a date of birth in the future", async () => {
    const user = await renderInEditMode();

    await user.type(screen.getByLabelText("Date of birth"), "2999-01-01");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("Date of birth cannot be in the future")
    ).toBeInTheDocument();
  });

  test("saving updates the displayed data", async () => {
    const user = await renderInEditMode();

    await user.clear(screen.getByLabelText("Full name"));
    await user.type(screen.getByLabelText("Full name"), "Layla Haddad");
    await user.type(screen.getByLabelText("Phone"), "+961 71 123 456");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Profile saved successfully.")).toBeInTheDocument();
    expect(screen.getByText("Layla Haddad")).toBeInTheDocument();
    expect(screen.getByText("+961 71 123 456")).toBeInTheDocument();

    // The change is also stored, so it survives a page refresh.
    expect((await getMyProfile()).fullName).toBe("Layla Haddad");
  });

  test("Cancel discards changes", async () => {
    const user = await renderInEditMode();

    await user.clear(screen.getByLabelText("Full name"));
    await user.type(screen.getByLabelText("Full name"), "Someone Else");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Demo User")).toBeInTheDocument();
    expect(screen.queryByText("Someone Else")).not.toBeInTheDocument();
  });

  test("labels the details as the account owner's", async () => {
    renderProfilePage();

    expect(await screen.findByRole("heading", { name: "Account owner" })).toBeInTheDocument();
  });

  test("explains whose settings these are while acting as a dependent", async () => {
    const maya = await addLinkedProfile({ fullName: "Maya", dateOfBirth: "2015-03-10", relationship: "child" });
    localStorage.setItem("nabad-active-profile-id", maya.id);

    renderProfilePage();

    expect(await screen.findByText("Acting as: Maya (child)")).toBeInTheDocument();
    expect(
      screen.getByText("You're managing Maya's care. Account settings below belong to you.")
    ).toBeInTheDocument();
    // The details below are still the account owner's.
    expect(screen.getByRole("heading", { name: "Account owner" })).toBeInTheDocument();
    expect(screen.getByText("demo@nabad.app")).toBeInTheDocument();
  });

  test("does not show the managing note while acting as yourself", async () => {
    renderProfilePage();
    await screen.findByRole("heading", { name: "Account owner" });

    expect(screen.queryByText(/You're managing/)).not.toBeInTheDocument();
  });

  test("shows the emergency contact placeholder", async () => {
    renderProfilePage();

    expect(await screen.findByText("Emergency contact")).toBeInTheDocument();
  });

  describe("Linked profiles", () => {
    // Renders the page, waits for it to load, and opens the "Add dependent" form.
    async function openAddDependentForm() {
      const user = userEvent.setup();
      renderProfilePage();
      await screen.findByText("Demo User", { selector: "p" });
      await user.click(screen.getByRole("button", { name: "Add dependent" }));
      return user;
    }

    test("shows a message when there are no linked profiles", async () => {
      renderProfilePage();

      expect(await screen.findByText("No linked profiles yet.")).toBeInTheDocument();
    });

    test("adding a dependent shows it in the list with relationship and age", async () => {
      const user = await openAddDependentForm();

      // A date of birth exactly 7 years ago today, so the age is always 7.
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const sevenYearsAgo = `${now.getFullYear() - 7}-${month}-${day}`;

      await user.type(screen.getByLabelText("Full name"), "Sami Haddad");
      await user.type(screen.getByLabelText("Date of birth"), sevenYearsAgo);
      await user.selectOptions(screen.getByLabelText("Relationship"), "child");
      await user.click(screen.getByRole("button", { name: "Save dependent" }));

      expect(await screen.findByText("Dependent added.")).toBeInTheDocument();
      expect(screen.getByText("Sami Haddad", { selector: "strong" })).toBeInTheDocument();
      expect(screen.getByText(/child, age 7/)).toBeInTheDocument();
      expect(screen.queryByText("No linked profiles yet.")).not.toBeInTheDocument();

      // It is also saved through the profile API.
      expect((await listLinkedProfiles())[0].fullName).toBe("Sami Haddad");
    });

    test("shows errors when the form is empty", async () => {
      const user = await openAddDependentForm();

      await user.click(screen.getByRole("button", { name: "Save dependent" }));

      expect(screen.getByText("Full name is required")).toBeInTheDocument();
      expect(screen.getByText("Date of birth is required")).toBeInTheDocument();
      expect(screen.getByText("Relationship is required")).toBeInTheDocument();
      expect(await listLinkedProfiles()).toEqual([]);
    });

    test("shows an error for a date of birth in the future", async () => {
      const user = await openAddDependentForm();

      await user.type(screen.getByLabelText("Full name"), "Sami");
      await user.type(screen.getByLabelText("Date of birth"), "2999-01-01");
      await user.selectOptions(screen.getByLabelText("Relationship"), "child");
      await user.click(screen.getByRole("button", { name: "Save dependent" }));

      expect(screen.getByText("Date of birth cannot be in the future")).toBeInTheDocument();
      expect(await listLinkedProfiles()).toEqual([]);
    });

    test("cannot add more than 10 dependents", async () => {
      for (let i = 1; i <= 10; i++) {
        await addLinkedProfile({ fullName: "Child " + i, dateOfBirth: "2015-03-10", relationship: "child" });
      }

      renderProfilePage();

      expect(await screen.findByText("Child 10", { selector: "strong" })).toBeInTheDocument();
      expect(screen.getByText("You can link up to 10 dependents.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add dependent" })).toBeDisabled();
    });
  });

  describe("Removing a linked profile", () => {
    // Adds a dependent called Maya, renders the page, and waits for her to appear.
    async function renderWithMaya() {
      const maya = await addLinkedProfile({ fullName: "Maya", dateOfBirth: "2015-03-10", relationship: "child" });
      const user = userEvent.setup();
      renderProfilePage();
      await screen.findByText("Maya", { selector: "strong" });
      return { user, maya };
    }

    test("removes the dependent after confirming", async () => {
      const { user } = await renderWithMaya();

      await user.click(screen.getByRole("button", { name: "Remove Maya" }));
      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByText("Remove Maya's profile? This deletes all of their data and cannot be undone.")
      ).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Remove" }));

      expect(await screen.findByText("Maya's profile was removed.")).toBeInTheDocument();
      expect(screen.queryByText("Maya", { selector: "strong" })).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(await listLinkedProfiles()).toEqual([]);
    });

    test("Cancel keeps the dependent", async () => {
      const { user } = await renderWithMaya();

      await user.click(screen.getByRole("button", { name: "Remove Maya" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("Maya", { selector: "strong" })).toBeInTheDocument();
      expect((await listLinkedProfiles())[0].fullName).toBe("Maya");
    });

    test("the account owner's own profile has no Remove button", async () => {
      await renderWithMaya();

      // The only Remove button belongs to the dependent.
      expect(screen.getAllByRole("button", { name: /^Remove/ })).toHaveLength(1);
      expect(screen.queryByRole("button", { name: "Remove Demo User" })).not.toBeInTheDocument();
    });

    test("removing the active dependent switches back to your own profile", async () => {
      const maya = await addLinkedProfile({ fullName: "Maya", dateOfBirth: "2015-03-10", relationship: "child" });
      localStorage.setItem("nabad-active-profile-id", maya.id);
      const user = userEvent.setup();
      renderProfilePage();
      expect(await screen.findByText("Acting as: Maya (child)")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Remove Maya" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }));

      await screen.findByText("Maya's profile was removed.");
      expect(screen.queryByText(/Acting as/)).not.toBeInTheDocument();
      expect(localStorage.getItem("nabad-active-profile-id")).toBe("self");
    });
  });

  describe("Deleting the account", () => {
    // Renders the page and opens the "Delete my account" dialog.
    async function openDeleteDialog() {
      const user = userEvent.setup();
      renderProfilePage();
      await user.click(await screen.findByRole("button", { name: "Delete my account" }));
      const dialog = screen.getByRole("dialog");
      const confirmButton = within(dialog).getByRole("button", { name: "Delete my account" });
      return { user, dialog, confirmButton };
    }

    test("shows a danger zone that lists what will be deleted", async () => {
      const { dialog } = await openDeleteDialog();

      expect(screen.getByRole("heading", { name: "Danger zone" })).toBeInTheDocument();
      expect(within(dialog).getByText("Your account")).toBeInTheDocument();
      expect(within(dialog).getByText("Your profile")).toBeInTheDocument();
      expect(within(dialog).getByText("All linked profiles")).toBeInTheDocument();
      expect(within(dialog).getByText("Your emergency contacts")).toBeInTheDocument();
    });

    test("the delete button stays disabled until DELETE is typed exactly", async () => {
      const { user, confirmButton } = await openDeleteDialog();
      const confirmInput = screen.getByLabelText("Type DELETE to confirm");

      await user.type(screen.getByLabelText("Password"), "demo1234");
      expect(confirmButton).toBeDisabled();

      await user.type(confirmInput, "delete");
      expect(confirmButton).toBeDisabled();

      await user.clear(confirmInput);
      await user.type(confirmInput, "DELET");
      expect(confirmButton).toBeDisabled();

      await user.type(confirmInput, "E");
      expect(confirmButton).toBeEnabled();
    });

    test("a wrong password shows an error and deletes nothing", async () => {
      await addLinkedProfile({ fullName: "Maya", dateOfBirth: "2015-03-10", relationship: "child" });
      const { user, confirmButton } = await openDeleteDialog();

      await user.type(screen.getByLabelText("Password"), "wrong");
      await user.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
      await user.click(confirmButton);

      expect(await screen.findByText("Password is incorrect.")).toBeInTheDocument();
      expect((await listLinkedProfiles())[0].fullName).toBe("Maya");
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    test("a successful deletion clears all data and goes to the landing page", async () => {
      const maya = await addLinkedProfile({ fullName: "Maya", dateOfBirth: "2015-03-10", relationship: "child" });
      localStorage.setItem("nabad-active-profile-id", maya.id);
      const { user, confirmButton } = await openDeleteDialog();

      await user.type(screen.getByLabelText("Password"), "demo1234");
      await user.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
      await user.click(confirmButton);

      // Signing out also stops the inactivity timer and tells the other tabs.
      expect(mockSignOut).toHaveBeenCalledWith("/?deleted=1");
      expect(fakeProfileApi.accountDeleted).toBe(true);
      expect(localStorage.getItem("nabad-active-profile-id")).toBeNull();
      expect(screen.queryByText(/Acting as/)).not.toBeInTheDocument();
    });

    test("a Google-only account confirms with its email instead of a password", async () => {
      fakeProfileApi.resetFakeProfiles({ authProvider: "google" });
      const { user, confirmButton } = await openDeleteDialog();

      expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
      await user.type(screen.getByLabelText("Email"), "someone@else.test");
      await user.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
      await user.click(confirmButton);
      expect(await screen.findByText("Email does not match.")).toBeInTheDocument();
      expect(fakeProfileApi.accountDeleted).toBe(false);

      await user.clear(screen.getByLabelText("Email"));
      await user.type(screen.getByLabelText("Email"), "demo@nabad.app");
      await user.click(confirmButton);

      expect(mockSignOut).toHaveBeenCalledWith("/?deleted=1");
      expect(fakeProfileApi.accountDeleted).toBe(true);
    });
  });
});
