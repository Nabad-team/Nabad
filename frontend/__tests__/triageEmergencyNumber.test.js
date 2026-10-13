import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TriagePage from "../pages/triage";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { assessSymptoms } from "../lib/triageApi";

jest.mock("../context/ActiveProfileContext", () => ({
  useActiveProfile: jest.fn(),
}));

jest.mock("../lib/triageApi", () => ({
  assessSymptoms: jest.fn(),
}));

jest.mock("../components/ProfileHeader", () => {
  return function MockProfileHeader() {
    return <div>Profile Header</div>;
  };
});

jest.mock("../components/ReadAloudButton", () => {
  return function MockReadAloudButton() {
    return <button>Read aloud</button>;
  };
});

describe("Emergency number alert", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    useActiveProfile.mockReturnValue({
      activeProfile: {
        id: "profile-1",
        fullName: "Karim Father",
      },
    });
  });

  test("shows emergency number when result is emergency", async () => {
    const user = userEvent.setup();

    assessSymptoms.mockResolvedValue({
      level: "emergency",
      disclaimer: "This is guidance, not a diagnosis.",
      routing: {
        emergency: true,
        contactName: "Lebanese Red Cross",
        contactNumber: "140",
        instructions:
          "If this may be an emergency, call 140 or go to the nearest emergency department now.",
      },
    });

    render(<TriagePage />);

    const symptomBox = screen.getByLabelText("Symptoms");

    await user.type(
      symptomBox,
      "I have a cough and chest pain"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Check urgency",
      })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Emergency — call now")
      ).toBeInTheDocument();
    });

    expect(
      screen.getAllByText("Lebanese Red Cross")
    ).toHaveLength(2);

    expect(
      screen.getByText(/Emergency number:/)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Call 140",
      })
    ).toHaveAttribute("href", "tel:140");
  });

  test("does not show emergency alert for non-emergency result", async () => {
    const user = userEvent.setup();

    assessSymptoms.mockResolvedValue({
      level: "needs_clinical_review",
      disclaimer: "This is guidance, not a diagnosis.",
      guidance:
        "Seek advice from a qualified healthcare professional.",
    });

    render(<TriagePage />);

    await user.type(
      screen.getByLabelText("Symptoms"),
      "I have a mild headache"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Check urgency",
      })
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Safety check result: needs_clinical_review"
        )
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Emergency — call now")
    ).not.toBeInTheDocument();
  });
});