import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import SymptomsPage from "../pages/symptoms";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { addSymptomRecord } from "../lib/symptomApi";
import { classifyUrgency } from "../lib/triageApi";

jest.mock("../context/ActiveProfileContext", () => ({
  useActiveProfile: jest.fn(),
}));

jest.mock("../lib/symptomApi", () => ({
  addSymptomRecord: jest.fn(),
}));

// SCRUM-128: the page now asks the backend for an urgency level after saving.
jest.mock("../lib/triageApi", () => ({
  classifyUrgency: jest.fn(),
}));

const EMERGENCY_RESULT = {
  level: "emergency",
  label: "Emergency",
  timeframe: "Now",
  action: "Call 140 (Lebanese Red Cross) or go to the nearest emergency department immediately.",
  reasons: ["Chest pain or pressure can be a sign of a heart attack."],
  disclaimer: "This is guidance, not a diagnosis. If you think it is an emergency, call 140 now.",
};

const SOON_RESULT = {
  level: "soon",
  label: "See a doctor soon",
  timeframe: "Within 24 to 48 hours",
  action: "Book an appointment with a doctor in the next day or two.",
  reasons: ["A fever should be checked by a doctor if it lasts or gets worse."],
  disclaimer: "This is guidance, not a diagnosis. If you think it is an emergency, call 140 now.",
};

describe("Symptoms Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  });

  test("shows a message when no active profile is selected", () => {
    useActiveProfile.mockReturnValue({
      activeProfile: null,
    });

    render(<SymptomsPage />);

    expect(
      screen.getByText("No active profile selected.")
    ).toBeInTheDocument();
  });

  test("shows the active linked profile name", () => {
    useActiveProfile.mockReturnValue({
      activeProfile: {
        id: "profile-1",
        fullName: "Maya Hamdan",
      },
    });

    render(<SymptomsPage />);

    expect(screen.getByText("Maya Hamdan")).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText("Enter symptoms for Maya Hamdan")
    ).toBeInTheDocument();
  });

  test("does not submit when symptoms are empty", async () => {
    const user = userEvent.setup();

    useActiveProfile.mockReturnValue({
      activeProfile: {
        id: "profile-1",
        fullName: "Maya Hamdan",
      },
    });

    render(<SymptomsPage />);

    await user.click(
      screen.getByRole("button", { name: "Submit Symptoms" })
    );

    expect(
      screen.getByText("Please enter symptoms.")
    ).toBeInTheDocument();

    expect(addSymptomRecord).not.toHaveBeenCalled();
  });

  test("saves symptoms for the selected linked profile", async () => {
    const user = userEvent.setup();

    useActiveProfile.mockReturnValue({
      activeProfile: {
        id: "profile-1",
        fullName: "Maya Hamdan",
      },
    });

    addSymptomRecord.mockResolvedValue({
      id: "symptom-1",
      profileId: "profile-1",
      profileName: "Maya Hamdan",
      symptoms: "Fever and headache",
    });

    render(<SymptomsPage />);

    const symptomBox = screen.getByPlaceholderText(
      "Enter symptoms for Maya Hamdan"
    );

    await user.type(symptomBox, "Fever and headache");

    await user.click(
      screen.getByRole("button", { name: "Submit Symptoms" })
    );

    await waitFor(() => {
      expect(addSymptomRecord).toHaveBeenCalledWith(
        "profile-1",
        "Maya Hamdan",
        "Fever and headache"
      );
    });
  });

  test("shows confirmation after symptoms are saved", async () => {
    const user = userEvent.setup();

    useActiveProfile.mockReturnValue({
      activeProfile: {
        id: "profile-1",
        fullName: "Maya Hamdan",
      },
    });

    addSymptomRecord.mockResolvedValue({
      id: "symptom-1",
    });

    render(<SymptomsPage />);

    await user.type(
      screen.getByPlaceholderText("Enter symptoms for Maya Hamdan"),
      "Cough and fever"
    );

    await user.click(
      screen.getByRole("button", { name: "Submit Symptoms" })
    );

    expect(
      await screen.findByText("Symptoms recorded for Maya Hamdan.")
    ).toBeInTheDocument();
  });

  test("adds spoken symptoms to the symptom box", async () => {
    const user = userEvent.setup();
    let recognition;

    window.SpeechRecognition = jest.fn(() => {
      recognition = {
        start: jest.fn(),
        stop: jest.fn(),
        abort: jest.fn(),
      };
      return recognition;
    });

    useActiveProfile.mockReturnValue({
      activeProfile: {
        id: "profile-1",
        fullName: "Maya Hamdan",
      },
    });

    render(<SymptomsPage />);

    await user.click(screen.getByRole("button", { name: "Speak symptoms" }));

    expect(recognition.start).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Stop listening" })
    ).toBeInTheDocument();

    await act(async () => {
      recognition.onresult({
        resultIndex: 0,
        results: [
          {
            isFinal: true,
            0: { transcript: "fever and headache" },
          },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Symptoms")).toHaveValue(
        "fever and headache"
      );
    });
  });

  test("hides voice input when speech recognition is unsupported", () => {
    useActiveProfile.mockReturnValue({
      activeProfile: {
        id: "profile-1",
        fullName: "Maya Hamdan",
      },
    });

    render(<SymptomsPage />);

    expect(
      screen.queryByRole("button", { name: "Speak symptoms" })
    ).not.toBeInTheDocument();
  });

  // ---- SCRUM-128: urgency classification ----

  async function submitSymptoms(text) {
    const user = userEvent.setup();
    useActiveProfile.mockReturnValue({
      activeProfile: { id: "profile-1", fullName: "Maya Hamdan" },
    });
    addSymptomRecord.mockResolvedValue({ id: "symptom-1" });
    render(<SymptomsPage />);
    await user.type(
      screen.getByPlaceholderText("Enter symptoms for Maya Hamdan"),
      text
    );
    await user.click(screen.getByRole("button", { name: "Submit Symptoms" }));
  }

  test("classifies the saved symptoms and shows how soon to get care", async () => {
    classifyUrgency.mockResolvedValue(SOON_RESULT);

    await submitSymptoms("Fever and headache");

    expect(classifyUrgency).toHaveBeenCalledWith("Fever and headache");
    expect(
      await screen.findByRole("heading", { name: "Urgency: See a doctor soon" })
    ).toBeInTheDocument();
    expect(screen.getByText("Within 24 to 48 hours")).toBeInTheDocument();
    expect(
      screen.getByText("A fever should be checked by a doctor if it lasts or gets worse.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Call 140 now" })).not.toBeInTheDocument();
  });

  test("an emergency result is announced as an alert with a call button", async () => {
    classifyUrgency.mockResolvedValue(EMERGENCY_RESULT);

    await submitSymptoms("Chest pain");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Urgency: Emergency");
    expect(screen.getByRole("link", { name: "Call 140 now" })).toHaveAttribute(
      "href",
      "tel:140"
    );
  });

  test("if classification fails, symptoms stay saved and the user is told what to do", async () => {
    classifyUrgency.mockRejectedValue(new Error("Request failed."));

    await submitSymptoms("Cough");

    expect(
      await screen.findByText(/could not check how urgent they are right now/)
    ).toBeInTheDocument();
    expect(screen.getByText("Symptoms recorded for Maya Hamdan.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Urgency:/ })).not.toBeInTheDocument();
  });

  test("does not classify when saving the symptoms fails", async () => {
    const user = userEvent.setup();
    useActiveProfile.mockReturnValue({
      activeProfile: { id: "profile-1", fullName: "Maya Hamdan" },
    });
    addSymptomRecord.mockRejectedValue(new Error("disk full"));
    render(<SymptomsPage />);

    await user.type(
      screen.getByPlaceholderText("Enter symptoms for Maya Hamdan"),
      "Cough"
    );
    await user.click(screen.getByRole("button", { name: "Submit Symptoms" }));

    expect(await screen.findByText("Could not save symptoms.")).toBeInTheDocument();
    expect(classifyUrgency).not.toHaveBeenCalled();
  });
});