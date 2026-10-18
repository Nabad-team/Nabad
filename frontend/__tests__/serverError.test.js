// Automated tests for the custom 500 page.
import { render, screen } from "@testing-library/react";
import ServerErrorPage from "../pages/500";

let mockSignedIn = false;
jest.mock("../components/SessionTimeout", () => ({ useSignedIn: () => mockSignedIn }));

describe("500 page", () => {
  beforeEach(() => {
    mockSignedIn = false;
  });

  test("says something went wrong on our side", () => {
    render(<ServerErrorPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText(/not something you did/)).toBeInTheDocument();
  });

  test("sends signed-out visitors back to the home page", () => {
    render(<ServerErrorPage />);
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
  });

  test("sends signed-in users back to their dashboard", () => {
    mockSignedIn = true;
    render(<ServerErrorPage />);
    expect(screen.getByRole("link", { name: "Go to your dashboard" })).toHaveAttribute("href", "/dashboard");
  });

  test("offers a way to report the problem", () => {
    render(<ServerErrorPage />);
    expect(screen.getByRole("link", { name: "let us know" })).toHaveAttribute("href", "/contact");
  });
});
