import { render, screen } from "@testing-library/react";
import PrivacyPolicy from "../pages/privacy";

describe("Privacy Policy Page", () => {
  test("shows the privacy policy title", () => {
    render(<PrivacyPolicy />);

    expect(
      screen.getByRole("heading", {
        name: "Nabad Privacy Policy",
      })
    ).toBeInTheDocument();
  });

  test("shows important privacy sections", () => {
    render(<PrivacyPolicy />);

    expect(
      screen.getByText("Information We Collect")
    ).toBeInTheDocument();

    expect(
      screen.getByText("How Your Information Is Used")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Who Can Access Your Information")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Data Security")
    ).toBeInTheDocument();
  });

  test("has a link back to the dashboard", () => {
    render(<PrivacyPolicy />);

    const backLink = screen.getByRole("link", {
      name: "Back to Dashboard",
    });

    expect(backLink).toHaveAttribute("href", "/dashboard");
  });
});