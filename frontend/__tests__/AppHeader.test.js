// Automated tests for the signed-in header: main navigation, the account menu, the phone menu,
// keyboard behavior and the current-page highlight.
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppHeader from "../components/AppHeader";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

// Full-page flows: slow under load for a good reason (see test-utils/timeouts.js).
jest.setTimeout(PAGE_FLOW_TIMEOUT);

jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
let mockSignedIn = true;
jest.mock("../components/SessionTimeout", () => ({
  ...jest.requireActual("../components/SessionTimeout"),
  useSessionStatus: () => (mockSignedIn ? "signedIn" : "signedOut"),
  useSignedIn: () => mockSignedIn,
}));
const mockSignOut = jest.fn();
jest.mock("../lib/session", () => ({ signOut: (...args) => mockSignOut(...args) }));

function renderHeader(path = "/dashboard") {
  window.history.pushState({}, "", path);
  return render(
    <ActiveProfileProvider>
      <AppHeader />
      <p><a href="/elsewhere">A link on the page</a></p>
    </ActiveProfileProvider>
  );
}
const accountButton = () => screen.getByRole("button", { name: "Account menu" });
const menuButton = () => screen.getByRole("button", { name: "Menu" });

describe("Header navigation", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
    mockSignedIn = true;
    jest.clearAllMocks();
  });

  test("keeps the desktop header focused on account controls", async () => {
    renderHeader();
    await screen.findByRole("option", { name: "Demo User (you)" });
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nabad/ })).toHaveAttribute("href", "/dashboard");
  });

  test("does not render desktop section navigation on the current page", async () => {
    renderHeader("/medications");
    await screen.findByRole("option", { name: "Demo User (you)" });
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
  });

  test("on an account page, the account button and the link inside the menu show it", async () => {
    const user = userEvent.setup({ delay: null });
    renderHeader("/security");
    await screen.findByRole("option", { name: "Demo User (you)" });
    expect(accountButton()).toHaveClass("account-menu__button--current");
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    await user.click(accountButton());
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "My profile" })).not.toHaveAttribute("aria-current");
  });

  test("shows the logo and public care link while signed out", () => {
    mockSignedIn = false;
    renderHeader();
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Account menu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Menu" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nabad/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Find care" })).toHaveAttribute("href", "/providers");
  });
});

describe("Account menu", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
    mockSignedIn = true;
    jest.clearAllMocks();
  });

  test("opens with the user's initials button, and moves focus into the menu", async () => {
    const user = userEvent.setup({ delay: null });
    renderHeader();
    await screen.findByRole("option", { name: "Demo User (you)" });

    expect(accountButton()).toHaveAttribute("aria-expanded", "false");
    expect(accountButton()).toHaveTextContent("DU");
    expect(screen.queryByRole("link", { name: "My profile" })).not.toBeInTheDocument();

    await user.click(accountButton());
    expect(accountButton()).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(accountButton().getAttribute("aria-controls"));
    expect(panel).toBeInTheDocument();
    expect(within(panel).getByText("Demo User")).toBeInTheDocument();
    expect(within(panel).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["My profile", "/profile"], ["Security", "/security"],
    ]);
    expect(within(panel).getByRole("link", { name: "My profile" })).toHaveFocus();
  });

  test("Sign out is in the menu", async () => {
    const user = userEvent.setup({ delay: null });
    renderHeader();
    await screen.findByRole("option", { name: "Demo User (you)" });
    await user.click(accountButton());
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  test("Escape closes it and puts focus back on the button", async () => {
    const user = userEvent.setup({ delay: null });
    renderHeader();
    await screen.findByRole("option", { name: "Demo User (you)" });
    await user.click(accountButton());
    await user.keyboard("{Escape}");
    expect(accountButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "My profile" })).not.toBeInTheDocument();
    expect(accountButton()).toHaveFocus();
  });

  test("works from the keyboard: Enter opens, Tab moves through, tabbing out closes", async () => {
    const user = userEvent.setup({ delay: null });
    renderHeader();
    await screen.findByRole("option", { name: "Demo User (you)" });
    accountButton().focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("link", { name: "My profile" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Security" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveFocus();
    await user.tab();
    expect(accountButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  test("Space toggles it, and clicking the button again closes it", async () => {
    const user = userEvent.setup({ delay: null });
    renderHeader();
    await screen.findByRole("option", { name: "Demo User (you)" });
    accountButton().focus();
    await user.keyboard(" ");
    expect(accountButton()).toHaveAttribute("aria-expanded", "true");
    await user.click(accountButton());
    expect(accountButton()).toHaveAttribute("aria-expanded", "false");
  });

  test("clicking outside closes it", async () => {
    const user = userEvent.setup({ delay: null });
    renderHeader();
    await screen.findByRole("option", { name: "Demo User (you)" });
    await user.click(accountButton());
    fireEvent.mouseDown(document.body);
    expect(accountButton()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("Phone menu", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
    mockSignedIn = true;
    jest.clearAllMocks();
  });

  test("opens a panel with the main links, the profile switcher, the account links and Sign out", async () => {
    const user = userEvent.setup({ delay: null });
    renderHeader("/water-and-sleep");
    await screen.findByRole("option", { name: "Demo User (you)" });
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");

    await user.click(menuButton());
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(menuButton().getAttribute("aria-controls"));
    const [main, account] = within(panel).getAllByRole("navigation");
    expect(main).toHaveAccessibleName("Main");
    expect(within(main).getAllByRole("link").map((link) => link.textContent)).toEqual(["Dashboard", "My health", "Medications", "Water and sleep", "Find care"]);
    expect(within(main).getByRole("link", { name: "Water and sleep" })).toHaveAttribute("aria-current", "page");
    expect(account).toHaveAccessibleName("Account");
    expect(within(account).getAllByRole("link").map((link) => link.textContent)).toEqual(["My profile", "Security"]);
    expect(within(panel).getByLabelText("Acting for")).toHaveValue("self");
    expect(within(panel).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    // Focus moves to the first link.
    expect(within(main).getByRole("link", { name: "Dashboard" })).toHaveFocus();
  });

  test("Escape closes it and puts focus back on Menu", async () => {
    const user = userEvent.setup({ delay: null });
    renderHeader();
    await screen.findByRole("option", { name: "Demo User (you)" });
    await user.click(menuButton());
    await user.keyboard("{Escape}");
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("mobile-menu")).not.toBeInTheDocument();
    expect(menuButton()).toHaveFocus();
  });

  test("switches the active profile from inside the panel", async () => {
    const user = userEvent.setup({ delay: null });
    const child = await fakeProfileApi.addLinkedProfile({ fullName: "Sami Haddad", dateOfBirth: "2018-04-02", relationship: "child" });
    renderHeader();
    await screen.findByRole("option", { name: "Demo User (you)" });
    await user.click(menuButton());
    await user.selectOptions(screen.getByLabelText("Acting for"), child.id);
    expect(screen.getByLabelText("Acting for")).toHaveValue(child.id);
    expect(screen.getByLabelText("Active profile")).toHaveValue(child.id);
    expect(localStorage.getItem("nabad-active-profile-id")).toBe(child.id);
  });

  test("Sign out from the panel", async () => {
    const user = userEvent.setup({ delay: null });
    renderHeader();
    await screen.findByRole("option", { name: "Demo User (you)" });
    await user.click(menuButton());
    await user.click(within(document.getElementById("mobile-menu")).getByRole("button", { name: "Sign out" }));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
