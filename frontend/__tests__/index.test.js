// Automated tests for the Nabad landing page.
// These tests run automatically on every pull request.

import { render, screen, within } from "@testing-library/react";
import HomePage from "../pages/index";

// The page reads the URL query from the router. Each test can change mockQuery.
let mockQuery = {};
jest.mock("next/router", () => ({
  useRouter: () => ({ query: mockQuery }),
}));

describe("Landing Page", () => {
  beforeEach(() => {
    mockQuery = {};
  });

  test("shows a message after the account was deleted", () => {
    mockQuery = { deleted: "1" };
    render(<HomePage />);

    expect(screen.getByText("Your account has been deleted.")).toBeInTheDocument();
  });

  test("does not show the deleted message on a normal visit", () => {
    render(<HomePage />);

    expect(screen.queryByText("Your account has been deleted.")).not.toBeInTheDocument();
  });

  test("shows the headline", () => {
    render(<HomePage />);

    expect(
      screen.getByText("Know where to go when it matters.")
    ).toBeInTheDocument();
  });

  test("logo links to the home page", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("link", { name: /Nabad/ })
    ).toHaveAttribute("href", "/");
  });

  test("Log in link points to /login", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("link", { name: "Log in" })
    ).toHaveAttribute("href", "/login");
  });

  test("Sign up and Get started links point to /signup", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("link", { name: "Sign up" })
    ).toHaveAttribute("href", "/signup");

    expect(
      screen.getByRole("link", { name: "Get started" })
    ).toHaveAttribute("href", "/signup");
  });

  test("lets anyone call the Lebanese Red Cross before signing in", () => {
    render(<HomePage />);

    // Said once: the top strip names who answers and that no account is needed (the old box at the bottom is gone).
    const emergencyCall = screen.getByRole("link", { name: /^Emergency\? Call 140/ });
    expect(emergencyCall).toHaveAttribute("href", "tel:140");
    expect(emergencyCall).toHaveTextContent("Lebanese Red Cross, no sign-in needed");
  });

  test("every feature card links to its page, and nothing says Coming soon", () => {
    render(<HomePage />);

    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    const features = screen.getByRole("heading", { name: "How Nabad helps" }).closest("section");
    // The whole card is the link; its bold title is the heading inside it.
    expect(within(features).getAllByRole("heading", { level: 3 }).map((heading) => [heading.textContent, heading.closest("a.feature-card")?.getAttribute("href")])).toEqual([
      ["Symptom check", "/symptoms"],
      ["The right hospital in an emergency", "/providers?emergency24h=true"],
      ["Find hospitals and clinics", "/providers"],
      ["Care for your family", "/profile"],
    ]);
  });

  test("lists the other things an account has, matching what exists", () => {
    render(<HomePage />);

    const more = screen.getByRole("heading", { name: "Also in your account" }).closest("section");
    for (const name of ["Medications and reminders", "Vitals", "Documents", "Visit preparation", "Care circle", "Offline emergency card"]) {
      expect(within(more).getByText(name)).toBeInTheDocument();
    }
  });

  test("has one slim Call 140 strip near the top (said once; the footer line has 140 too)", () => {
    render(<HomePage />);

    const bar = screen.getByRole("link", { name: "Emergency? Call 140 · Lebanese Red Cross, no sign-in needed" });
    expect(bar).toHaveAttribute("href", "tel:140");
    const main = document.querySelector("main");
    expect(main.querySelector("a")).toBe(bar);
    expect(main.querySelectorAll('a[href="tel:140"]')).toHaveLength(1);
  });

  test("shows a clearly labelled sample result instead of a drawing", () => {
    render(<HomePage />);

    const sample = screen.getByRole("figure", { name: /An example result, with made-up symptoms/ });
    expect(within(sample).getByText("Sample")).toBeInTheDocument();
    expect(sample).toHaveTextContent("Urgency: See a doctor soon");
    const current = within(sample).getAllByRole("listitem").filter((step) => step.getAttribute("aria-current") === "step");
    expect(current.map((step) => step.textContent)).toEqual(["See a doctor soonThis result"]);
    // Nothing in the sample can be clicked or focused.
    expect(within(sample).queryAllByRole("link")).toHaveLength(0);
    expect(within(sample).queryAllByRole("button")).toHaveLength(0);
  });

  test("credits the team only once, in the site footer", () => {
    const { container } = render(<HomePage />);

    expect(container).not.toHaveTextContent("Nabad, built by Team 3 for CMPS 271, AUB");
    expect(screen.getAllByText(/Built by Team 3 for CMPS 271/)).toHaveLength(1);
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Built by Team 3 for CMPS 271 at the American University of Beirut.");
  });
});
