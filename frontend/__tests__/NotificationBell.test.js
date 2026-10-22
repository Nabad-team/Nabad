// The header notifications bell: unread badge, the live-region count, refreshing every minute and on focus,
// the panel with the latest five, "Mark all as read", keyboard use, and its place in the header at every width.
import { render, screen, within, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationBell from "../components/NotificationBell";
import AppHeader from "../components/AppHeader";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import * as fake from "../test-utils/fakeNotificationApi";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

jest.setTimeout(PAGE_FLOW_TIMEOUT);

jest.mock("../lib/notificationApi", () => require("../test-utils/fakeNotificationApi"));
jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
jest.mock("../components/SessionTimeout", () => ({
  ...jest.requireActual("../components/SessionTimeout"),
  useSessionStatus: () => "signedIn",
  useSignedIn: () => true,
}));
jest.mock("../lib/session", () => ({ signOut: jest.fn() }));

const bell = () => screen.getByRole("button", { name: /^Notifications/ });
const countCalls = () => fake.calls.filter((call) => call === "getUnreadCount").length;
const liveRegion = (container) => container.querySelector("[aria-live]");

describe("Notification bell", () => {
  // jsdom can't follow links: record where a click would have gone instead.
  let followed;
  const follow = (event) => {
    const link = event.target.closest("a");
    if (link) { followed = link.getAttribute("href"); event.preventDefault(); }
  };
  beforeEach(() => {
    fake.resetFakeNotifications();
    followed = null;
    document.addEventListener("click", follow);
  });
  afterEach(() => document.removeEventListener("click", follow));
  afterEach(() => jest.useRealTimers());

  test("shows the unread count on a badge and in the button's name, and announces it", async () => {
    fake.seedNotification(); fake.seedNotification(); fake.seedNotification({ read: true });
    const { container } = render(<NotificationBell />);
    expect(await screen.findByRole("button", { name: "Notifications, 2 unread notifications" })).toBeInTheDocument();
    expect(bell().querySelector(".notification-bell__badge")).toHaveTextContent("2");
    expect(bell().querySelector(".notification-bell__badge")).toHaveAttribute("aria-hidden", "true");
    expect(liveRegion(container)).toHaveAttribute("aria-live", "polite");
    expect(liveRegion(container)).toHaveTextContent("2 unread notifications");
  });

  test("with nothing unread there is no badge and nothing is announced on load", async () => {
    const { container } = render(<NotificationBell />);
    await waitFor(() => expect(countCalls()).toBe(1));
    expect(bell()).toHaveAccessibleName("Notifications");
    expect(bell().querySelector(".notification-bell__badge")).toBeNull();
    expect(liveRegion(container)).toHaveTextContent("");
  });

  test("shows 9+ for more than nine", async () => {
    for (let index = 0; index < 12; index += 1) fake.seedNotification();
    render(<NotificationBell />);
    await screen.findByRole("button", { name: "Notifications, 12 unread notifications" });
    expect(bell().querySelector(".notification-bell__badge")).toHaveTextContent("9+");
  });

  test("checks the count every 60 seconds and when the tab regains focus, announcing changes", async () => {
    jest.useFakeTimers();
    const { container } = render(<NotificationBell />);
    await act(async () => {});
    expect(countCalls()).toBe(1);
    fake.seedNotification();
    await act(async () => { jest.advanceTimersByTime(59000); });
    expect(countCalls()).toBe(1);
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(countCalls()).toBe(2);
    expect(liveRegion(container)).toHaveTextContent("1 unread notification");
    fake.seedNotification();
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(countCalls()).toBe(3);
    expect(bell()).toHaveAccessibleName("Notifications, 2 unread notifications");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(countCalls()).toBe(4);
  });

  test("the panel lists the latest five, marks all as read, and links to the full page", async () => {
    const user = userEvent.setup({ delay: null });
    for (let index = 1; index <= 7; index += 1) fake.seedNotification({ title: `Reminder ${index}` });
    const { container } = render(<NotificationBell />);
    await screen.findByRole("button", { name: /7 unread/ });
    await user.click(bell());
    expect(bell()).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("region", { name: "Notifications" });
    const list = await within(panel).findByRole("list", { name: "Latest notifications" });
    expect(within(list).getAllByRole("link").map((link) => link.textContent)).toEqual(
      [7, 6, 5, 4, 3].map((n) => expect.stringContaining(`Reminder ${n}`))
    );
    expect(within(list).getAllByRole("link")[0]).toHaveTextContent(/^Unread: /);
    expect(within(panel).getByRole("link", { name: "See all notifications" })).toHaveAttribute("href", "/notifications");

    await user.click(within(panel).getByRole("button", { name: "Mark all as read" }));
    await screen.findByRole("button", { name: "Notifications" });
    expect(fake.storedNotifications().every((item) => item.read)).toBe(true);
    expect(within(panel).getByRole("button", { name: "Mark all as read" })).toBeDisabled();
    expect(within(list).getAllByRole("link")[0]).not.toHaveTextContent(/Unread/);
    expect(liveRegion(container)).toHaveTextContent("No unread notifications");
  });

  test("opening a notification follows its link and marks it read with a request that outlives the page", async () => {
    const user = userEvent.setup({ delay: null });
    const id = fake.seedNotification({ title: "Appointment reminder", link: "/appointments" });
    render(<NotificationBell />);
    await screen.findByRole("button", { name: /1 unread/ });
    await user.click(bell());
    await user.click(await screen.findByRole("link", { name: /Appointment reminder/ }));
    expect(followed).toBe("/appointments");
    expect(fake.calls).toContainEqual(["markNotificationRead", id, { keepalive: true }]);
    await waitFor(() => expect(fake.storedNotifications().find((item) => item.id === id).read).toBe(true));
  });

  test("works with the keyboard: Enter opens, focus moves in, Escape closes and returns focus", async () => {
    const user = userEvent.setup({ delay: null });
    fake.seedNotification();
    render(<NotificationBell />);
    await screen.findByRole("button", { name: /1 unread/ });
    bell().focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Mark all as read" })).toHaveFocus();
    await screen.findByRole("list", { name: "Latest notifications" });
    await user.tab();
    expect(screen.getByRole("link", { name: /Unread/ })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
    expect(bell()).toHaveFocus();
  });

  test("shows an empty message and a load error in the panel", async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationBell />);
    await waitFor(() => expect(countCalls()).toBe(1));
    await user.click(bell());
    expect(await screen.findByText("You have no notifications yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
    await user.click(bell());
    fake.failures.add("getNotifications");
    await user.click(bell());
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your notifications.");
  });

  test("sits in the header outside the desktop-only controls, so phones get it too", async () => {
    fake.seedNotification();
    render(<ActiveProfileProvider><AppHeader /></ActiveProfileProvider>);
    const button = await screen.findByRole("button", { name: /1 unread/ });
    expect(button.closest(".app-header__desktop")).toBeNull();
    expect(button.closest(".app-header__end")).not.toBeNull();
    expect(screen.getAllByRole("button", { name: /^Notifications/ })).toHaveLength(1);
  });
});
