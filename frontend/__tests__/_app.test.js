// Automated tests for the custom Next.js App (pages/_app.js).
// These tests run automatically on every pull request.

import { render, screen, act } from "@testing-library/react";
import MyApp from "../pages/_app";
import { useActiveProfile } from "../context/ActiveProfileContext";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";

// The app also runs the inactivity timer, which needs a router and asks the server
// whether the user is signed in. Each test decides the answer.
const mockGetSession = jest.fn();
jest.mock("next/router", () => ({
  useRouter: () => ({ asPath: "/", replace: jest.fn() }),
}));
jest.mock("../lib/api", () => ({
  getSession: () => mockGetSession(),
}));

// The profile API is replaced by an in-memory fake of the backend.
jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));

// A tiny fake page that shows the active profile's name from the context.
function FakePage({ greeting }) {
  const { activeProfile } = useActiveProfile();
  return <p>{greeting}, {activeProfile ? activeProfile.fullName : "..."}</p>;
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
  });

  test("renders the page with its props inside the active profile provider", async () => {
    mockGetSession.mockResolvedValue({ idleTimeoutMs: 30 * 60 * 1000, warningBeforeMs: 2 * 60 * 1000, absoluteExpiresAt: Date.now() + 60 * 60 * 1000 });
    render(<MyApp Component={FakePage} pageProps={{ greeting: "Hello" }} />);

    expect(await screen.findByText("Hello, Demo User")).toBeInTheDocument();
  });

  test("does not load a profile while signed out", async () => {
    mockGetSession.mockRejectedValue(new Error("Not authenticated."));
    render(<MyApp Component={FakePage} pageProps={{ greeting: "Hello" }} />);

    expect(await screen.findByText("Hello, ...")).toBeInTheDocument();
    await act(async () => {});
    expect(fakeProfileApi.profileLoads).toBe(0);
  });
});
