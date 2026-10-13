import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TriagePage from "../pages/triage";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { assessSymptoms } from "../lib/triageApi";
import { getEmergencyContact } from "../lib/api";

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

describe("Emergency contact during emergency alert", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    useActiveProfile.mockReturnValue({
      activeProfile: {
        id: "profile-1",
        fullName: "Karim Father",
      },
    });
  });

  test("shows saved emergency contact during an emergency", async () => {
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

    getEmergencyContact.mockResolvedValue({
      contact: {
        name: "Mom",
        phone: "+96171123456",
      },
    });

    render(<TriagePage />);

    await user.type(
      screen.getByLabelText("Symptoms"),
      "I have a cough and chest pain"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Check urgency",
      })
    );

    expect(
      await screen.findByText("Your emergency contact")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Mom")
    ).toBeInTheDocument();

    expect(
      screen.getByText("+96171123456")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Call Mom",
      })
    ).toHaveAttribute(
      "href",
      "tel:+96171123456"
    );
  });

  test("loads emergency contact only for emergency results", async () => {
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
      getEmergencyContact
    ).not.toHaveBeenCalled();

    expect(
      screen.queryByText("Your emergency contact")
    ).not.toBeInTheDocument();
  });

  test("still shows emergency alert if contact cannot be loaded", async () => {
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

    getEmergencyContact.mockRejectedValue(
      new Error("Could not load contact")
    );

    render(<TriagePage />);

    await user.type(
      screen.getByLabelText("Symptoms"),
      "I have a cough and chest pain"
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
      screen.getByRole("link", {
        name: "Call 140",
      })
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Your emergency contact")
    ).not.toBeInTheDocument();
  });
});