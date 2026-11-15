// The phone bottom tab bar: four tabs, the current page, and the Menu tab that opens the phone menu.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fs from "fs";
import path from "path";
import AppHeader from "../components/AppHeader";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

jest.setTimeout(PAGE_FLOW_TIMEOUT);

jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
jest.mock("../components/SessionTimeout", () => ({
  ...jest.requireActual("../components/SessionTimeout"),
  useSessionStatus: () => "signedIn",
  useSignedIn: () => true,
}));
jest.mock("../lib/session", () => ({ signOut: jest.fn() }));

function renderHeader(pagePath) {
  window.history.pushState({}, "", pagePath);
  return render(
    <ActiveProfileProvider>
      <AppHeader />
    </ActiveProfileProvider>
  );
}
const bar = () => screen.getByRole("navigation", { name: "Quick links" });

describe("Bottom tab bar", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
  });

  test("is a labelled navigation landmark with three links and Menu, each with an icon and a text label", async () => {
    renderHeader("/dashboard");
    await screen.findByRole("option", { name: "Demo User (you)" });
    const items = within(bar()).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Symptom check", "Dashboard", "Find care", "Menu"]);
    expect(within(bar()).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/symptoms", "/dashboard", "/providers"]);
    for (const item of items) expect(item.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    // It sits outside the header (banner) landmark.
    expect(screen.getByRole("banner")).not.toContainElement(bar());
  });

  test("marks the current page's tab with aria-current", async () => {
    renderHeader("/providers");
    await screen.findByRole("option", { name: "Demo User (you)" });
    expect(within(bar()).getByRole("link", { name: "Find care" })).toHaveAttribute("aria-current", "page");
    expect(within(bar()).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    expect(within(bar()).getByRole("button", { name: "Menu" })).not.toHaveClass("tab-bar__item--current");
  });

  test("shows Menu as the current section on a page that lives in the menu", async () => {
    renderHeader("/medications");
    await screen.findByRole("option", { name: "Demo User (you)" });
    const menu = within(bar()).getByRole("button", { name: "Menu, current section" });
    expect(menu).toHaveClass("tab-bar__item--current");
    expect(within(bar()).queryByRole("link", { current: "page" })).toBeNull();
  });

  test("Menu opens the phone menu with the My care and My records groups, and Escape returns focus to it", async () => {
    const user = userEvent.setup({ delay: null });
    renderHeader("/dashboard");
    await screen.findByRole("option", { name: "Demo User (you)" });
    const menu = within(bar()).getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(menu.getAttribute("aria-controls"));
    expect(within(panel).getByText("My care")).toBeInTheDocument();
    expect(within(panel).getByText("My records")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(document.getElementById("mobile-menu")).not.toBeInTheDocument();
    expect(menu).toHaveFocus();
  });

  test("the header no longer has its own Menu button", async () => {
    renderHeader("/dashboard");
    await screen.findByRole("option", { name: "Demo User (you)" });
    expect(within(screen.getByRole("banner")).queryByRole("button", { name: /^Menu/ })).toBeNull();
  });
});

describe("Bottom tab bar styles", () => {
  const css = fs.readFileSync(path.join(__dirname, "../styles/components.css"), "utf8").replace(/\r\n/g, "\n");

  test("only shows on phones, with safe-area padding, and never on paper", () => {
    expect(css).toMatch(/\.tab-bar \{\s*display: none;/);
    const phone = css.slice(css.indexOf("@media (max-width: 39.99rem) {\n  .tab-bar {"));
    expect(phone).toMatch(/env\(safe-area-inset-bottom\)/);
    expect(phone).toMatch(/body:has\(\.tab-bar\) \{[^}]*padding-bottom/);
    expect(css).toMatch(/@media print \{\s*\.tab-bar,\s*\.mobile-menu \{\s*display: none !important;/);
  });

  test("the offline emergency page is a static page without the app's navigation", () => {
    const offline = fs.readFileSync(path.join(__dirname, "../public/offline.html"), "utf8");
    expect(offline).not.toMatch(/tab-bar/);
  });
});
