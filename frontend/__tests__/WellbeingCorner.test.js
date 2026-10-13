import { render, screen } from "@testing-library/react";
import WellbeingCorner from "../components/WellbeingCorner";

describe("Wellbeing Corner", () => {
  test("shows the wellbeing corner title", () => {
    render(<WellbeingCorner />);

    expect(
      screen.getByText("Wellbeing Corner")
    ).toBeInTheDocument();
  });

  test("shows a daily wellbeing message", () => {
    render(<WellbeingCorner />);

    expect(
      screen.getByText("Today's message")
    ).toBeInTheDocument();
  });

  test("shows simple wellbeing tips", () => {
    render(<WellbeingCorner />);

    expect(
      screen.getByText("Simple wellbeing tips")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Take a short break if you feel overwhelmed."
      )
    ).toBeInTheDocument();
  });

  test("shows National Lifeline 1564", () => {
    render(<WellbeingCorner />);

    expect(
      screen.getByText("National Lifeline 1564")
    ).toBeInTheDocument();

    const callLink = screen.getByRole("link", {
      name: "Call 1564",
    });

    expect(callLink).toHaveAttribute("href", "tel:1564");
  });

  test("shows support information for Lebanon", () => {
    render(<WellbeingCorner />);

    expect(
      screen.getByText("Support in Lebanon")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Psychological support and suicide prevention hotline/
      )
    ).toBeInTheDocument();
  });
});