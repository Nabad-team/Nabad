// Automated tests for the Contact page.
import { render, screen } from "@testing-library/react";
import ContactPage from "../pages/contact";
import { CONTACT_EMAIL } from "../components/ui/PageLayout";

describe("Contact page", () => {
  test("shows the title", () => {
    render(<ContactPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Contact us" })).toBeInTheDocument();
  });

  test("links the team's email address", () => {
    render(<ContactPage />);
    expect(CONTACT_EMAIL).toBe("nabad.team.lb@gmail.com");
    expect(screen.getByRole("link", { name: CONTACT_EMAIL })).toHaveAttribute("href", `mailto:${CONTACT_EMAIL}`);
  });

  test("explains how to report a problem without sharing private details", () => {
    render(<ContactPage />);
    expect(screen.getByRole("heading", { level: 2, name: "Report a problem" })).toBeInTheDocument();
    expect(screen.getByText(/Please don't include passwords or health details/)).toBeInTheDocument();
  });

  test("says it is not for medical help and gives the emergency number", () => {
    const { container } = render(<ContactPage />);
    expect(screen.getByText("This is not for medical help.")).toBeInTheDocument();
    expect(container).toHaveTextContent("In an emergency, call 140.");
  });
});
