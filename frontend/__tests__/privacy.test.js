import { render, screen } from "@testing-library/react";
import PrivacyPolicy from "../pages/privacy";

describe("Privacy Policy Page", () => {
  test("shows the privacy policy title", () => {
    render(<PrivacyPolicy />);

    expect(
      screen.getByRole("heading", {
        name: "Privacy Policy",
      })
    ).toBeInTheDocument();
  });

  test("shows important privacy sections", () => {
    render(<PrivacyPolicy />);

    expect(
      screen.getByText("Information Nabad stores")
    ).toBeInTheDocument();

    expect(
      screen.getByText("How symptom information is used")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Services Nabad uses")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Logs and health information")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Account security")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Your choices and deleting your data")
    ).toBeInTheDocument();
  });

  test("shows the last updated date", () => {
    render(<PrivacyPolicy />);

    expect(
      screen.getByText(/October 16, 2026/)
    ).toBeInTheDocument();
  });

  test("mentions the services Nabad uses", () => {
    render(<PrivacyPolicy />);

    expect(screen.getByText("Vercel")).toBeInTheDocument();
    expect(screen.getByText("Render")).toBeInTheDocument();
    expect(screen.getByText("MongoDB Atlas")).toBeInTheDocument();
    expect(screen.getByText("Brevo")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("OpenStreetMap")).toBeInTheDocument();
  });

  test("has a link back to the dashboard", () => {
    render(<PrivacyPolicy />);

    expect(
      screen.getByRole("link", {
        name: "Back to Dashboard",
      })
    ).toHaveAttribute("href", "/dashboard");
  });
});