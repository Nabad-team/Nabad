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

  test("explains how the AI in the symptom check uses the description", () => {
    const { container } = render(<PrivacyPolicy />);

    expect(screen.getByRole("heading", { name: "AI in the symptom check" })).toHaveAttribute("id", "ai-symptom-check");
    expect(container).toHaveTextContent("sent over an encrypted connection to Google's Gemini AI service to help assess urgency");
    expect(container).toHaveTextContent("your description is not sent to the AI");
    expect(container).toHaveTextContent("Your name, email and profile details are not sent with your description.");
    expect(container).toHaveTextContent("Nabad does not write your description or the AI's reply to its logs.");
    expect(container).not.toHaveTextContent("train AI");
    expect(container).not.toHaveTextContent("outside AI company");
    expect(screen.getByText("Google Gemini")).toBeInTheDocument();
  });

  test("explains how the health assistant and report review use the AI", () => {
    const { container } = render(<PrivacyPolicy />);

    expect(screen.getByRole("heading", { name: "AI in the health assistant" })).toHaveAttribute("id", "ai-health-assistant");
    expect(container).toHaveTextContent("any report you attach are sent over an encrypted connection to Google's Gemini AI service");
    expect(container).toHaveTextContent("Your name, email and profile details are not sent with your question.");
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