import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmergencyLocationShare from "../components/EmergencyLocationShare";
import { contactNumber, locationSnapshot, locationSmsUrl } from "../lib/emergencyLocation";

const contact = { name: "Rana", phone: "+96170123456" };
const props = { profileId: "self", contact, loading: false, error: false, onRetry: jest.fn() };
const position = () => ({ coords: { latitude: 33.9, longitude: 35.5, accuracy: 12.2 }, timestamp: Date.now() });
const geo = implementation => {
  const fn = jest.fn(implementation);
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: fn } });
  return fn;
};
beforeEach(() => jest.clearAllMocks());

test("validates coordinates, freshness and phone numbers before producing a draft", () => {
  const fix = locationSnapshot(position());
  expect(fix.url).toBe("https://www.google.com/maps/search/?api=1&query=33.900000,35.500000");
  expect(fix.accuracy).toBe(13);
  expect(locationSnapshot({ coords: { latitude: 0, longitude: 0 } }).url).toContain("0.000000,0.000000");
  for (const coords of [{ latitude: 91, longitude: 0 }, { latitude: 0, longitude: Infinity }, { latitude: NaN, longitude: 0 }]) expect(() => locationSnapshot({ coords })).toThrow();
  expect(() => locationSnapshot({ ...position(), timestamp: Date.now() - 180000 })).toThrow(/Stale/);
  expect(contactNumber("+961 70 123 456")).toBe(contact.phone);
  expect(contactNumber("+96170123456?body=override")).toBeNull();
  expect(locationSmsUrl("bad", fix)).toBeNull();
  const draft = locationSmsUrl(contact.phone, fix);
  expect(draft).toMatch(/^sms:\+96170123456\?body=/);
  expect(decodeURIComponent(draft.split("body=")[1])).toContain(fix.url);
  expect(decodeURIComponent(draft.split("body=")[1])).toContain(fix.capturedAt);
  expect(locationSmsUrl(contact.phone, fix, true)).toMatch(/^sms:\+96170123456&body=/);
});

test("location is opt-in; a fresh fix produces a pre-addressed draft with no automatic sending", async () => {
  const locate = geo(success => success(position()));
  const user = userEvent.setup(); render(<EmergencyLocationShare {...props} />);
  expect(locate).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: /Text location/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Share my location with Rana" }));
  expect(locate).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
  expect(screen.getByRole("link", { name: "Text location to Rana" })).toHaveAttribute("href", expect.stringMatching(/^sms:\+96170123456\?body=/));
  expect(screen.getByText(/does not send a message or confirm delivery/)).toBeInTheDocument();
  expect(screen.getByText(/Accuracy about 13 m/)).toBeInTheDocument();
  expect(screen.getByLabelText("Location link").value).toContain("33.900000,35.500000");
});

test.each([[1, /access was denied/], [2, /is unavailable/], [3, /took too long/]])("GPS failure %s is actionable and can be retried", async (code, message) => {
  const locate = geo((success, failure) => failure({ code }));
  const user = userEvent.setup(); render(<EmergencyLocationShare {...props} />);
  await user.click(screen.getByRole("button", { name: "Share my location with Rana" }));
  expect(screen.getByRole("alert")).toHaveTextContent(message);
  expect(screen.queryByRole("link", { name: /Text location/ })).not.toBeInTheDocument();
  locate.mockImplementation(success => success(position()));
  await user.click(screen.getByRole("button", { name: "Share my location with Rana" }));
  expect(screen.getByRole("link", { name: /Text location/ })).toBeInTheDocument();
});

test("unsupported GPS and synchronous security errors do not strand a pending request", async () => {
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
  const user = userEvent.setup(); render(<EmergencyLocationShare {...props} />);
  await user.click(screen.getByRole("button", { name: "Share my location with Rana" }));
  expect(screen.getByRole("alert")).toHaveTextContent("cannot get your location");
  geo(() => { throw new DOMException("blocked", "SecurityError"); });
  await user.click(screen.getByRole("button", { name: "Share my location with Rana" }));
  expect(screen.getByRole("alert")).toHaveTextContent("unavailable in this browser");
  expect(screen.getByRole("button", { name: "Share my location with Rana" })).toBeEnabled();
});

test("invalid or stale fixes never enable sharing", async () => {
  geo(success => success({ ...position(), timestamp: Date.now() - 180000 }));
  const user = userEvent.setup(); render(<EmergencyLocationShare {...props} />);
  await user.click(screen.getByRole("button", { name: "Share my location with Rana" }));
  expect(screen.getByRole("alert")).toHaveTextContent("fresh location could not be determined");
  expect(screen.queryByLabelText("Location link")).not.toBeInTheDocument();
});

test("copy link fallback writes only the map link; failed copying offers selectable text", async () => {
  geo(success => success(position()));
  const user = userEvent.setup();
  const copy = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
  render(<EmergencyLocationShare {...props} />);
  await user.click(screen.getByRole("button", { name: "Share my location with Rana" }));
  await user.click(screen.getByRole("button", { name: "Copy location link" }));
  expect(copy).toHaveBeenCalledWith(screen.getByLabelText("Location link").value);
  expect(screen.getByRole("status")).toHaveTextContent("Location link copied");
  copy.mockRejectedValue(new Error("denied"));
  await user.click(screen.getByRole("button", { name: "Copy location link" }));
  expect(screen.getByRole("status")).toHaveTextContent("Select and copy");
  expect(screen.getByLabelText("Location link")).toHaveFocus();
});

test("no valid contact or a failed lookup never starts geolocation, and retry stays available", async () => {
  const locate = geo(success => success(position()));
  const user = userEvent.setup(); const view = render(<EmergencyLocationShare {...props} contact={null} />);
  expect(screen.getByRole("link", { name: "Add an emergency contact" })).toHaveAttribute("href", "/profile");
  expect(locate).not.toHaveBeenCalled();
  view.rerender(<EmergencyLocationShare {...props} error />);
  await user.click(screen.getByRole("button", { name: "Retry emergency contact" }));
  expect(props.onRetry).toHaveBeenCalledTimes(1);
  view.rerender(<EmergencyLocationShare {...props} profileId="child" contact={null} />);
  expect(screen.queryByRole("link", { name: "Add an emergency contact" })).not.toBeInTheDocument();
});

test("changing profile/contact invalidates a pending fix and discards previous coordinates", async () => {
  let success; geo(callback => { success = callback; });
  const user = userEvent.setup(); const view = render(<EmergencyLocationShare {...props} />);
  await user.click(screen.getByRole("button", { name: "Share my location with Rana" }));
  view.rerender(<EmergencyLocationShare {...props} profileId="child" contact={{ name: "Child contact", phone: "+96171987654" }} />);
  act(() => success(position()));
  expect(screen.queryByLabelText("Location link")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Share my location with Child contact" })).toBeInTheDocument();
});

test("late GPS completion after the alert closes cannot expose coordinates on reopening", async () => {
  let success; geo(callback => { success = callback; });
  const user = userEvent.setup(); const view = render(<EmergencyLocationShare {...props} />);
  await user.click(screen.getByRole("button", { name: "Share my location with Rana" }));
  view.unmount(); act(() => success(position()));
  render(<EmergencyLocationShare {...props} />);
  expect(screen.queryByLabelText("Location link")).not.toBeInTheDocument();
});

test("a ready fix expires without silently tracking or leaving an old draft available", () => {
  jest.useFakeTimers();
  try {
    const locate = geo(success => success(position()));
    render(<EmergencyLocationShare {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Share my location with Rana" }));
    expect(screen.getByRole("link", { name: /Text location/ })).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(120000));
    expect(screen.queryByRole("link", { name: /Text location/ })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("location has expired");
    expect(locate).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});
