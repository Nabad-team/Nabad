import { fireEvent, render, screen } from "@testing-library/react";
import AppointmentsPage from "../pages/appointments";

jest.mock("../components/ProfileHeader", () => () => <div />);
jest.mock("../context/ActiveProfileContext", () => ({
  useActiveProfile: () => ({ activeProfile: { id: "self", isSelf: true }, error: "" }),
}));
jest.mock("../context/AccessibilityContext", () => ({
  useAccessibility: () => ({ preferences: { simplifiedMode: false } }),
}));
jest.mock("../lib/appointmentApi", () => ({
  REMINDER_OPTIONS: [[60, "1 hour before"]],
  getAppointments: jest.fn().mockResolvedValue([]),
  addAppointment: jest.fn(),
  updateAppointment: jest.fn(),
  deleteAppointment: jest.fn(),
}));

function setPermission(permission, requestPermission = jest.fn().mockResolvedValue(permission)) {
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: { permission, requestPermission },
  });
  return requestPermission;
}

describe("appointment reminder permissions", () => {
  beforeEach(() => setPermission("default"));

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
});
