// Automated tests for the inactivity sign-out timer (components/SessionTimeout.js).
// Jest's fake timers let us jump 30 minutes ahead instantly.
import { render, screen, act, fireEvent } from "@testing-library/react";
import SessionTimeout from "../components/SessionTimeout";
import ProfileHeader from "../components/ProfileHeader";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import { LAST_ACTIVITY_KEY, SIGN_OUT_KEY } from "../lib/session";

const replace = jest.fn();
const getSession = jest.fn();
const logout = jest.fn();

jest.mock("next/router", () => ({
  __esModule: true,
  default: { replace: (...args) => replace(...args) },
  useRouter: () => ({ asPath: "/dashboard", replace: (...args) => replace(...args) }),
}));

jest.mock("../lib/api", () => ({
  getSession: (...args) => getSession(...args),
  logout: (...args) => logout(...args),
}));

// The profile API is replaced by an in-memory fake of the backend.
jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
import * as fakeProfileApi from "../test-utils/fakeProfileApi";

const MINUTE = 60 * 1000;
const WARNING_TEXT = "You'll be signed out in 2 minutes for your privacy.";

// Moves the fake clock forward and lets pending promises (API calls) finish.
async function wait(ms) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

// Renders the timer and waits for the "am I signed in?" check.
async function renderSignedIn() {
  render(<SessionTimeout />);
  await wait(0);
}

describe("SessionTimeout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    localStorage.clear();
    getSession.mockResolvedValue({ idleTimeoutMs: 30 * MINUTE, warningBeforeMs: 2 * MINUTE, absoluteExpiresAt: Date.now() + 12 * 60 * MINUTE });
    logout.mockResolvedValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("shows the warning after 28 minutes of inactivity", async () => {
    await renderSignedIn();

    await wait(27 * MINUTE + 59 * 1000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await wait(1000);
    expect(screen.getByRole("dialog")).toHaveTextContent(WARNING_TEXT);
    expect(screen.getByRole("button", { name: "Stay signed in" })).toBeInTheDocument();
    // Same font as the pages (they set it on <main>, which the dialog is outside of).
    expect(screen.getByRole("dialog").closest('[style*="font-family"]')).toHaveStyle({ fontFamily: "sans-serif" });
  });

  test("signs out after 30 minutes of inactivity and tells the other tabs", async () => {
    await renderSignedIn();

    await wait(29 * MINUTE + 59 * 1000);
    expect(logout).not.toHaveBeenCalled();

    await wait(1000);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login?reason=inactivity&minutes=30");
    expect(JSON.parse(localStorage.getItem(SIGN_OUT_KEY)).url).toBe("/login?reason=inactivity&minutes=30");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("activity restarts the 30 minutes and is reported to the server", async () => {
    await renderSignedIn();

    await wait(27 * MINUTE);
    fireEvent.keyDown(window, { key: "a" });
    // The server hears about the activity within a minute, which renews its session.
    await wait(1 * MINUTE);
    expect(getSession).toHaveBeenCalledTimes(2);

    // 30 minutes after first load, but only 3 minutes after the key press.
    await wait(2 * MINUTE);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();

    // 28 minutes after the key press.
    await wait(25 * MINUTE);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("Stay signed in closes the warning and keeps the user signed in", async () => {
    await renderSignedIn();
    await wait(28 * MINUTE);
    // Moving the mouse towards the button does not close the warning by itself.
    fireEvent.mouseMove(window);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
    await wait(0);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getSession).toHaveBeenCalledTimes(2);
    await wait(5 * MINUTE);
    expect(logout).not.toHaveBeenCalled();
  });

  test("activity in another tab keeps this tab signed in", async () => {
    await renderSignedIn();

    await wait(27 * MINUTE);
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));

    await wait(5 * MINUTE);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  test("signing out in another tab signs out this tab", async () => {
    await renderSignedIn();

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: SIGN_OUT_KEY, newValue: JSON.stringify({ url: "/login", at: Date.now() }) }));
    });

    expect(replace).toHaveBeenCalledWith("/login");
  });

  test("signs out when the server says the session has ended", async () => {
    await renderSignedIn();
    getSession.mockRejectedValue(Object.assign(new Error("Session expired. Please log in again."), { status: 401 }));

    fireEvent.keyDown(window, { key: "a" });
    await wait(1 * MINUTE);

    expect(replace).toHaveBeenCalledWith("/login?reason=expired");
  });

  test("does nothing while signed out", async () => {
    getSession.mockRejectedValue(Object.assign(new Error("Not authenticated."), { status: 401 }));
    await renderSignedIn();

    await wait(31 * MINUTE);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  test("shows the Sign out button while signed in", async () => {
    render(
      <ActiveProfileProvider>
        <SessionTimeout>
          <ProfileHeader />
        </SessionTimeout>
      </ActiveProfileProvider>
    );
    await wait(0);

    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  test("after Sign out in this tab, the timer stops (no second sign-out later)", async () => {
    render(
      <ActiveProfileProvider>
        <SessionTimeout>
          <ProfileHeader />
        </SessionTimeout>
      </ActiveProfileProvider>
    );
    await wait(0);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await wait(0);
    expect(replace).toHaveBeenCalledWith("/login");
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();

    // Before the fix, activity here sent a heartbeat that got a 401 and signed out a second time.
    getSession.mockRejectedValue(Object.assign(new Error("Not authenticated."), { status: 401 }));
    fireEvent.keyDown(window, { key: "a" });
    await wait(31 * MINUTE);

    expect(logout).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  // Nested like in _app.js: the profile provider reads the sign-in state from SessionTimeout.
  function renderWithProfiles() {
    render(
      <SessionTimeout>
        <ActiveProfileProvider>
          <ProfileHeader />
        </ActiveProfileProvider>
      </SessionTimeout>
    );
  }

  test("hides the Sign out button and loads no profile while signed out", async () => {
    fakeProfileApi.resetFakeProfiles();
    getSession.mockRejectedValue(Object.assign(new Error("Not authenticated."), { status: 401 }));
    renderWithProfiles();
    await wait(0);

    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Demo User (you)" })).not.toBeInTheDocument();
    expect(fakeProfileApi.profileLoads).toBe(0);
  });

  test("loads the profiles once signed in and forgets them after timing out", async () => {
    fakeProfileApi.resetFakeProfiles();
    renderWithProfiles();
    await wait(0);

    expect(await screen.findByRole("option", { name: "Demo User (you)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();

    await wait(30 * MINUTE);

    expect(screen.queryByRole("option", { name: "Demo User (you)" })).not.toBeInTheDocument();
  });
});
