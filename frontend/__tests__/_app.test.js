// Automated tests for the custom Next.js App (pages/_app.js).
// These tests run automatically on every pull request.

import { render, screen } from "@testing-library/react";
import MyApp from "../pages/_app";
import { useActiveProfile } from "../context/ActiveProfileContext";

// The app also runs the inactivity timer, which needs a router and asks the server
// whether the user is signed in. Here the user is signed out, so the timer stays off.
jest.mock("next/router", () => ({
  useRouter: () => ({ asPath: "/", replace: jest.fn() }),
}));
jest.mock("../lib/api", () => ({
  getSession: () => Promise.reject(new Error("Not authenticated.")),
}));

// A tiny fake page that shows the active profile's name from the context.
function FakePage({ greeting }) {
  const { activeProfile } = useActiveProfile();
  return <p>{greeting}, {activeProfile ? activeProfile.fullName : "..."}</p>;
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("renders the page with its props inside the active profile provider", async () => {
    render(<MyApp Component={FakePage} pageProps={{ greeting: "Hello" }} />);

    expect(await screen.findByText("Hello, Demo User")).toBeInTheDocument();
  });
});
