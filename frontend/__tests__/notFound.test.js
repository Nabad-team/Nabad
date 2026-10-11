// Automated tests for the custom 404 page.
import { render, screen } from "@testing-library/react";
import NotFoundPage from "../pages/404";

let mockSignedIn = false;
jest.mock("../components/SessionTimeout", () => ({ useSignedIn: () => mockSignedIn }));

describe("404 page", () => {
  beforeEach(() => {
    mockSignedIn = false;
  });

  test("says the page could not be found", () => {
    render(<NotFoundPage />);
    expect(screen.getByRole("heading", { level: 1, name: "We couldn't find that page" })).toBeInTheDocument();
  });

  test("sends signed-out visitors back to the home page", () => {
    render(<NotFoundPage />);
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
  });

  test("sends signed-in users back to their dashboard", () => {
    mockSignedIn = true;
    render(<NotFoundPage />);
    expect(screen.getByRole("link", { name: "Go to your dashboard" })).toHaveAttribute("href", "/dashboard");
  });
});
