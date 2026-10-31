import { render, screen, within } from "@testing-library/react";
import WellbeingCorner, { WellbeingSupportNumber } from "../components/WellbeingCorner";
import { wellbeingSupport } from "../data/wellbeingSupport";

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
  test("each callable support number has its own verification date and official source", () => {
    render(<WellbeingCorner />);
    for (const contact of wellbeingSupport) {
      const entry = screen.getByRole("region", { name: contact.name });
      expect(within(entry).getByRole("link", { name: `Call ${contact.phone}` })).toHaveAttribute("href", `tel:${contact.phone}`);
      expect(entry.querySelector("time")).toHaveAttribute("datetime", contact.verifiedOn);
      expect(entry).toHaveTextContent(/Last verified: \d{1,2} [A-Za-z]+ \d{4}/);
      const source = within(entry).getByRole("link", { name: `Official verification source for ${contact.name}` });
      expect(source).toHaveAttribute("href", contact.sourceUrl);
      expect(source).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(screen.queryByText(/Numbers last verified:/)).not.toBeInTheDocument();
    expect(screen.getByText(/not a live phone-line availability check/)).toBeInTheDocument();
  });

  test("independent dates remain attached to the right number rather than a shared label", () => {
    render(<>
      <WellbeingSupportNumber contact={{ ...wellbeingSupport[0], verifiedOn: "2026-10-16" }} />
      <WellbeingSupportNumber contact={{ ...wellbeingSupport[1], verifiedOn: "2026-10-31" }} />
    </>);
    expect(screen.getByRole("region", { name: "National Lifeline 1564" })).toHaveTextContent("Last verified: 16 October 2026");
    expect(screen.getByRole("region", { name: "Lebanese Red Cross 140" })).toHaveTextContent("Last verified: 31 October 2026");
  });

  test.each([undefined, "", "not-a-date", "2026-02-30", "2025-02-29", "2026-13-01"])("an unavailable/invalid date (%s) does not invent verification", verifiedOn => {
    render(<WellbeingSupportNumber contact={{ ...wellbeingSupport[0], verifiedOn }} />);
    expect(screen.getByText("Verification date unavailable.")).toBeInTheDocument();
    expect(screen.queryByText(/Last verified:/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call 1564" })).toHaveAttribute("href", "tel:1564");
  });

  test("rendering on a later day never refreshes the recorded verification date", () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date("2030-01-01T12:00:00Z"));
      render(<WellbeingSupportNumber contact={{ ...wellbeingSupport[0], verifiedOn: "2026-10-16" }} />);
      expect(screen.getByText("16 October 2026")).toHaveAttribute("datetime", "2026-10-16");
      expect(screen.queryByText(/2030/)).not.toBeInTheDocument();
    } finally { jest.useRealTimers(); }
  });

  test("curated entries have distinct IDs, canonical dates and HTTPS sources", () => {
    expect(new Set(wellbeingSupport.map(contact => contact.id)).size).toBe(wellbeingSupport.length);
    for (const contact of wellbeingSupport) {
      expect(contact.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${contact.verifiedOn}T00:00:00Z`).toISOString().slice(0, 10)).toBe(contact.verifiedOn);
      expect(new URL(contact.sourceUrl).protocol).toBe("https:");
      expect(contact.phone).toMatch(/^\d+$/);
    }
  });
});
