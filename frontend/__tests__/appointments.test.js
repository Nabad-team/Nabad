import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AppointmentsPage, { medicationEventsForDate } from "../pages/appointments";
import { getMedications } from "../lib/medicationApi";

jest.mock("../components/ProfileHeader", () => () => <div />);
jest.mock("../context/ActiveProfileContext", () => ({
  useActiveProfile: () => ({ activeProfile: { id: "self", isSelf: true }, error: "" }),
}));
jest.mock("../context/AccessibilityContext", () => ({
  useAccessibility: () => ({ preferences: { simplifiedMode: false } }),
}));
jest.mock("../lib/appointmentApi", () => ({
  REMINDER_OPTIONS: [[15, "15 minutes before"], [60, "1 hour before"], [90, "90 minutes before"]],
  getAppointments: jest.fn().mockResolvedValue([]),
  addAppointment: jest.fn(),
  updateAppointment: jest.fn(),
  deleteAppointment: jest.fn(),
}));
jest.mock("../lib/medicationApi", () => ({ getMedications: jest.fn().mockResolvedValue([]) }));

function setPermission(permission, requestPermission = jest.fn().mockResolvedValue(permission)) {
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: { permission, requestPermission },
  });
  return requestPermission;
}

describe("appointment reminder permissions", () => {
  beforeEach(() => { setPermission("default"); getMedications.mockReset().mockResolvedValue([]); });

  test("builds calendar events only for active medication dates", () => {
    const medications = [{ id: "med-1", name: "Aspirin", status: "active", startDate: "2026-11-01", endDate: "2026-11-30", times: ["08:00", "20:00"] }];
    expect(medicationEventsForDate(medications, "2026-11-03")).toEqual([
      { id: "med-1-08:00", time: "08:00", name: "Aspirin" },
      { id: "med-1-20:00", time: "20:00", name: "Aspirin" },
    ]);
    expect(medicationEventsForDate(medications, "2026-12-01")).toEqual([]);
  });

  test("supports keyboard movement and announces the selected date", async () => {
    const { container } = render(<AppointmentsPage />);
    const calendar = await screen.findByRole("region", { name: "Calendar dates" });
    const dates = within(calendar).getAllByRole("button");
    dates[8].focus();
    fireEvent.keyDown(dates[8], { key: "ArrowRight" });
    expect(dates[9]).toHaveFocus();
    fireEvent.keyDown(dates[9], { key: "ArrowDown" });
    expect(dates[16]).toHaveFocus();
    fireEvent.click(dates[16]);
    expect(dates[16]).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector(".calendar-details")).toHaveAttribute("aria-live", "polite");
  });

  test("asks only after the user selects Enable reminders and handles a grant", async () => {
    const requestPermission = setPermission("default", jest.fn().mockResolvedValue("granted"));
    render(<AppointmentsPage />);
    expect(await screen.findByRole("button", { name: "Enable reminders" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enable reminders" }));
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Browser reminders are enabled while this page is open.")).toBeInTheDocument();
  });

  test("explains when permission is denied", async () => {
    const requestPermission = setPermission("default", jest.fn().mockResolvedValue("denied"));
    render(<AppointmentsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Enable reminders" }));
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Notifications are blocked in your browser settings/)).toBeInTheDocument();
  });

  test("does not request permission again when the browser already denied it", async () => {
    const requestPermission = setPermission("denied");
    render(<AppointmentsPage />);
    expect(await screen.findByText(/Notifications are blocked in browser settings/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enable reminders" })).not.toBeInTheDocument();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  test("does not prompt when permission is already granted", async () => {
    const requestPermission = setPermission("granted");
    render(<AppointmentsPage />);
    expect(await screen.findByText(/while this page is open/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enable reminders" })).not.toBeInTheDocument();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  test("a rescheduled appointment can fire a new reminder with the same id", async () => {
    const now = new Date();
    const appointmentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const timeInMinutes = (offset) => {
      const value = new Date(now.getTime() + offset * 60000);
      return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
    };
    const appointment = {
      id: "visit-1", title: "Check-up", hospital: "Clinic", location: "", notes: "",
      appointmentDate, appointmentTime: timeInMinutes(10), reminderMinutes: 15,
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
    const rescheduled = { ...appointment, appointmentTime: timeInMinutes(80), reminderMinutes: 90, updatedAt: new Date().toISOString() };
    const getAppointments = require("../lib/appointmentApi").getAppointments;
    getAppointments.mockReset().mockResolvedValueOnce([appointment]).mockResolvedValueOnce([rescheduled]);
    const updateAppointment = require("../lib/appointmentApi").updateAppointment;
    updateAppointment.mockReset().mockResolvedValue({});
    const notification = jest.fn();
    notification.permission = "granted";
    notification.requestPermission = jest.fn();
    Object.defineProperty(window, "Notification", { configurable: true, value: notification });

    render(<AppointmentsPage />);
    await screen.findByRole("heading", { name: "Check-up" });
    await waitFor(() => expect(notification).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Edit Check-up" }));
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: rescheduled.appointmentTime } });
    fireEvent.change(screen.getByLabelText("Remind me"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(notification).toHaveBeenCalledTimes(2));
    expect(notification.mock.calls[1][0]).toContain("Check-up");
  });
});
