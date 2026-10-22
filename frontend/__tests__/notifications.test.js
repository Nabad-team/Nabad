// The /notifications page: full history, filters (all, unread, by profile), mark read, delete, mark all,
// paging and the empty state. The preferences section on the profile page is tested at the bottom.
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationsPage from "../pages/notifications";
import NotificationPreferences from "../components/NotificationPreferences";
import * as fake from "../test-utils/fakeNotificationApi";
import { NOTIFICATIONS_CHANGED } from "../lib/notificationApi";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

jest.setTimeout(PAGE_FLOW_TIMEOUT);

jest.mock("../lib/notificationApi", () => require("../test-utils/fakeNotificationApi"));
jest.mock("../components/ProfileHeader", () => () => <div />);
// next/head only fills <head> inside a running Next.js app; here it renders its tags in place.
jest.mock("next/head", () => ({ __esModule: true, default: ({ children }) => <>{children}</> }));
jest.mock("../context/ActiveProfileContext", () => ({
  useActiveProfile: () => ({
    selfProfile: { id: "self", fullName: "Demo User", isSelf: true },
    linkedProfiles: [{ id: "sami", fullName: "Sami", relationship: "child" }],
  }),
}));

const list = () => screen.findByRole("list", { name: "Notifications" });
const titles = async () => within(await list()).getAllByRole("heading").map((heading) => heading.textContent.replace("Unread: ", ""));

describe("Notifications page", () => {
  beforeEach(() => fake.resetFakeNotifications());

  test("has the page title and shows an empty state", async () => {
    render(<NotificationsPage />);
    expect(NotificationsPage.requireSignIn).toBe(true);
    expect(screen.getByRole("heading", { level: 1, name: "Notifications" })).toBeInTheDocument();
    expect(await screen.findByText("No notifications yet.")).toBeInTheDocument();
    expect(document.querySelector("title")).toHaveTextContent("Notifications · Nabad");
  });

  test("lists notifications newest first, with unread ones marked and the person's name", async () => {
    fake.seedNotification({ title: "Older", read: true });
    fake.seedNotification({ title: "Sami's appointment", profileId: "sami", message: "Sami's appointment at AUBMC is in 1 hour (10:00)." });
    render(<NotificationsPage />);
    expect(await titles()).toEqual(["Sami's appointment", "Older"]);
    const [newest, older] = within(await list()).getAllByRole("listitem");
    expect(within(newest).getByRole("heading")).toHaveTextContent(/^Unread: /);
    expect(newest).toHaveTextContent("· Sami");
    expect(within(newest).getByRole("link", { name: "Sami's appointment" })).toHaveAttribute("href", "/appointments");
    expect(within(older).queryByRole("button", { name: /Mark .* as read/ })).not.toBeInTheDocument();
  });

  test("a care circle alert can be called from the list", async () => {
    fake.seedNotification({ type: "caregiver_urgent", title: "Care circle alert", message: "Rana's symptom check needs attention (urgent).", link: "/notifications", phone: "+96170123456" });
    fake.seedNotification({ title: "No phone here" });
    render(<NotificationsPage />);
    const [noPhone, alert] = within(await list()).getAllByRole("listitem");
    expect(within(alert).getByRole("link", { name: /^Call \+96170123456/ })).toHaveAttribute("href", "tel:+96170123456");
    expect(within(noPhone).queryByRole("link", { name: /^Call/ })).not.toBeInTheDocument();
  });

  test("filters by unread and by person, with an empty state for no matches", async () => {
    const user = userEvent.setup({ delay: null });
    fake.seedNotification({ title: "Mine read", read: true });
    fake.seedNotification({ title: "Mine unread" });
    fake.seedNotification({ title: "Sami's", profileId: "sami", read: true });
    render(<NotificationsPage />);
    expect(await titles()).toHaveLength(3);
    await user.selectOptions(screen.getByLabelText("Show"), "unread");
    await waitFor(async () => expect(await titles()).toEqual(["Mine unread"]));
    await user.selectOptions(screen.getByLabelText("Person"), "sami");
    expect(await screen.findByText("No notifications match these filters.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Show"), "all");
    await waitFor(async () => expect(await titles()).toEqual(["Sami's"]));
    expect(fake.calls).toContainEqual(["getNotifications", { page: 1, limit: 20, profileId: "sami", unread: false }]);
  });

  test("marks one as read, deletes one, and marks all as read, telling the header bell each time", async () => {
    const user = userEvent.setup({ delay: null });
    const changed = jest.fn();
    window.addEventListener(NOTIFICATIONS_CHANGED, changed);
    fake.seedNotification({ title: "First" });
    fake.seedNotification({ title: "Second" });
    fake.seedNotification({ title: "Third" });
    render(<NotificationsPage />);
    await list();
    await user.click(screen.getByRole("button", { name: 'Mark "Third" as read' }));
    expect(await screen.findByRole("status")).toHaveTextContent("Notification marked as read.");
    expect(screen.queryByRole("button", { name: 'Mark "Third" as read' })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: 'Delete "Second"' }));
    await waitFor(async () => expect(await titles()).toEqual(["Third", "First"]));
    await user.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(await screen.findByText("All notifications marked as read.")).toBeInTheDocument();
    expect(fake.storedNotifications().every((item) => item.read)).toBe(true);
    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
    expect(changed).toHaveBeenCalledTimes(3);
    window.removeEventListener(NOTIFICATIONS_CHANGED, changed);
    // The page doesn't reload itself for its own changes.
    expect(fake.calls.filter((call) => Array.isArray(call) && call[0] === "getNotifications")).toHaveLength(1);
  });

  test("reloads when the header bell marks everything read", async () => {
    fake.seedNotification({ title: "Only" });
    render(<NotificationsPage />);
    await screen.findByRole("button", { name: 'Mark "Only" as read' });
    await fake.markAllNotificationsRead();
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    await waitFor(() => expect(screen.queryByRole("button", { name: 'Mark "Only" as read' })).not.toBeInTheDocument());
  });

  test("shows older notifications a page at a time", async () => {
    const user = userEvent.setup({ delay: null });
    for (let index = 1; index <= 25; index += 1) fake.seedNotification({ title: `Item ${index}` });
    render(<NotificationsPage />);
    expect(await titles()).toHaveLength(20);
    await user.click(screen.getByRole("button", { name: "Show older notifications" }));
    await waitFor(async () => expect(await titles()).toHaveLength(25));
    expect((await titles()).at(-1)).toBe("Item 1");
    expect(screen.queryByRole("button", { name: "Show older notifications" })).not.toBeInTheDocument();
  });

  test("keeps every page at the API's page size, and skips nothing after a delete", async () => {
    const user = userEvent.setup({ delay: null });
    for (let index = 1; index <= 70; index += 1) fake.seedNotification({ title: `Item ${index}` });
    render(<NotificationsPage />);
    expect(await titles()).toHaveLength(20);
    await user.click(screen.getByRole("button", { name: 'Delete "Item 70"' }));
    await user.click(screen.getByRole("button", { name: "Show older notifications" }));
    await waitFor(async () => expect(await titles()).toHaveLength(40));
    // Offset paging would have skipped Item 50 here, the first item to move up a page after the delete.
    expect((await titles()).slice(18, 21)).toEqual(["Item 51", "Item 50", "Item 49"]);
    await user.click(screen.getByRole("button", { name: "Show older notifications" }));
    await user.click(await screen.findByRole("button", { name: "Show older notifications" }));
    await waitFor(async () => expect(await titles()).toHaveLength(69));
    expect(new Set(await titles()).size).toBe(69);
    const limits = fake.calls.filter((call) => Array.isArray(call) && call[0] === "getNotifications").map(([, query]) => query.limit);
    expect(Math.max(...limits)).toBe(20);
  });

  test("explains a failed load and a failed action", async () => {
    const user = userEvent.setup({ delay: null });
    fake.failures.add("getNotifications");
    render(<NotificationsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your notifications.");
    fake.failures.delete("getNotifications");
    fake.seedNotification({ title: "Retry" });
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await list();
    fake.failures.add("deleteNotification");
    await user.click(screen.getByRole("button", { name: 'Delete "Retry"' }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't delete that notification.");
    expect(await titles()).toEqual(["Retry"]);
  });
});

describe("Notification preferences", () => {
  beforeEach(() => fake.resetFakeNotifications());

  test("shows a switch per type, with safety-critical types always on", async () => {
    render(<NotificationPreferences />);
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeInTheDocument();
    const reminders = await screen.findByRole("checkbox", { name: "Appointment reminders" });
    expect(reminders).toBeChecked();
    expect(reminders).toBeEnabled();
    for (const name of [/^Emergency alerts/, /^Care circle alerts/]) {
      const box = screen.getByRole("checkbox", { name });
      expect(box).toBeChecked();
      expect(box).toHaveAttribute("aria-disabled", "true");
      expect(box).toHaveAccessibleDescription(/can't be turned off/);
    }
    expect(screen.getAllByText("Always on")).toHaveLength(2);
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
  });

  test("always-on types can't be switched off by clicking or with the keyboard", async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationPreferences />);
    const box = await screen.findByRole("checkbox", { name: /^Emergency alerts/ });
    await user.click(box);
    box.focus();
    await user.keyboard(" ");
    expect(box).toBeChecked();
    expect(fake.calls.filter((call) => Array.isArray(call) && call[0] === "updateNotificationPreferences")).toHaveLength(0);
  });

  test("saves each change straight away and undoes it if saving fails", async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationPreferences />);
    await user.click(await screen.findByRole("checkbox", { name: "Appointment reminders" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Notification settings saved.");
    expect(screen.getByRole("checkbox", { name: "Appointment reminders" })).not.toBeChecked();
    expect(fake.calls).toContainEqual(["updateNotificationPreferences", { appointment_reminder: false }]);

    fake.failures.add("updateNotificationPreferences");
    await user.click(screen.getByRole("checkbox", { name: "Documents ready" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't save that change.");
    expect(screen.getByRole("checkbox", { name: "Documents ready" })).toBeChecked();
  });

  test("explains when the settings can't be loaded", async () => {
    fake.failures.add("getNotificationPreferences");
    render(<NotificationPreferences />);
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load your notification settings.");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
