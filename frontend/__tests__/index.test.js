// Automated tests for the Nabad landing page.
// These tests run automatically on every pull request.

import { render, screen } from "@testing-library/react";
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

  test("marks only the features that are not ready yet as coming soon", () => {
    render(<HomePage />);

    const comingSoon = screen.getAllByText("Coming soon").map((badge) => badge.closest("h3").textContent);
    expect(comingSoon).toEqual([
      "The right hospital in an emergency Coming soon",
    ]);
  });
});
