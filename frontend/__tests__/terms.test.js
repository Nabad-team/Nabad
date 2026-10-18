// Automated tests for the Terms of Use page.
import { render, screen } from "@testing-library/react";
import TermsOfUse from "../pages/terms";

describe("Terms of Use page", () => {
  test("shows the title and the date of the latest version", () => {
    render(<TermsOfUse />);
    expect(screen.getByRole("heading", { level: 1, name: "Terms of Use" })).toBeInTheDocument();
    expect(screen.getByText(/October 18, 2026/)).toBeInTheDocument();
  });

  test("puts the emergency number first", () => {
    render(<TermsOfUse />);
    const emergency = screen.getByText("In an emergency, call 140 now.");
    const disclaimer = screen.getByRole("heading", { name: "Medical disclaimer" });
    expect(emergency.compareDocumentPosition(disclaimer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("has a clear medical disclaimer", () => {
    const { container } = render(<TermsOfUse />);
    expect(container).toHaveTextContent("Nabad gives general guidance only. It does not diagnose illness");
    expect(container).toHaveTextContent("Nabad is not a substitute for a doctor.");
    expect(container).toHaveTextContent("call 140 immediately");
  });

  test("says the AI can make mistakes, that Nabad is a student project, and how it may be used", () => {
    render(<TermsOfUse />);
    for (const name of ["The AI can make mistakes", "A student project", "Acceptable use"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByText(/AI answers can be wrong/)).toBeInTheDocument();
    expect(screen.getByText(/not a certified medical device/)).toBeInTheDocument();
    expect(screen.getByText("Not try to access other people's accounts or data.")).toBeInTheDocument();
  });

  test("links to the Privacy Policy and the Contact page", () => {
    render(<TermsOfUse />);
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Contact the team" })).toHaveAttribute("href", "/contact");
  });
});
