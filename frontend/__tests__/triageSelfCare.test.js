import { render, screen } from "@testing-library/react";
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

jest.mock("../lib/api", () => ({
  getEmergencyContact: jest.fn(),
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

describe("Self-care guidance", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    useActiveProfile.mockReturnValue({
      activeProfile: {
        id: "profile-1",
        fullName: "Karim Father",
      },
    });
  });

  test("shows self-care guidance for a routine result", async () => {
    const user = userEvent.setup();

    assessSymptoms.mockResolvedValue({
      level: "routine",
      disclaimer: "This is guidance, not a diagnosis.",
      guidance:
        "Your symptoms matched a non-urgent care rule. You can consider the following self-care steps:",
      selfCareGuidance: [
        "Rest and avoid strenuous activity while you are feeling unwell.",
        "Drink enough fluids unless a healthcare professional has told you to limit fluids.",
        "Monitor your symptoms and how you are feeling.",
        "Seek medical advice if your symptoms worsen, do not improve, or you become concerned.",
      ],
    });

    render(<TriagePage />);

    await user.type(
      screen.getByLabelText("Symptoms"),
      "I have a cough"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Check urgency",
      })
    );

    expect(
      await screen.findByText("Self-care guidance")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Rest and avoid strenuous activity while you are feeling unwell."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Monitor your symptoms and how you are feeling."
      )
    ).toBeInTheDocument();
  });

  test("does not show self-care guidance for emergency results", async () => {
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

    await user.type(
      screen.getByLabelText("Symptoms"),
      "I have chest pain"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Check urgency",
      })
    );

    expect(
      await screen.findByText("Emergency — call now")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Self-care guidance")
    ).not.toBeInTheDocument();
  });
});