import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import SymptomsPage from "../pages/symptoms";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { addSymptomRecord } from "../lib/symptomApi";
import { classifyUrgency, refineUrgency } from "../lib/triageApi";

jest.mock("../context/ActiveProfileContext", () => ({
  useActiveProfile: jest.fn(),
}));

jest.mock("../lib/symptomApi", () => ({
  addSymptomRecord: jest.fn(),
}));

// SCRUM-128: the page now asks the backend for an urgency level after saving.
jest.mock("../lib/triageApi", () => ({
  classifyUrgency: jest.fn(),
  refineUrgency: jest.fn(),
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

// SCRUM-126: a first result that comes back with follow-up questions.
const SOON_WITH_QUESTIONS = {
  ...SOON_RESULT,
  followUpQuestions: [
    {
      id: "fever-temperature",
      text: "What is the highest temperature you measured?",
      options: [
        { value: "under-38", label: "Below 38°C" },
        { value: "39.5-plus", label: "39.5°C or higher" },
      ],
    },
    {
      id: "severity",
      text: "How bad are the symptoms right now?",
      options: [
        { value: "mild", label: "Mild: I can do my normal activities" },
        { value: "severe", label: "Severe: I can hardly function" },
      ],
    },
  ],
};

const URGENT_REFINED = {
  level: "urgent",
  label: "Urgent",
  timeframe: "Within a few hours (today)",
  action: "Get seen today at an emergency department or urgent care clinic. Call 140 if it gets worse.",
  confidence: "refined",
  reasons: ["A temperature of 39.5°C or higher should be checked today."],
  followUpQuestions: [],
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
      screen.getByPlaceholderText("For example: headache since yesterday and a mild fever.")
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
      screen.getByRole("button", { name: "Submit symptoms" })
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

    const symptomBox = screen.getByLabelText("Symptoms");

    await user.type(symptomBox, "Fever and headache");

    await user.click(
      screen.getByRole("button", { name: "Submit symptoms" })
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
      screen.getByLabelText("Symptoms"),
      "Cough and fever"
    );

    await user.click(
      screen.getByRole("button", { name: "Submit symptoms" })
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

  test("starts listening straight away when opened from the dashboard's Speak button", async () => {
    const recognition = { start: jest.fn(), stop: jest.fn(), abort: jest.fn() };
    window.SpeechRecognition = jest.fn(() => recognition);
    useActiveProfile.mockReturnValue({ activeProfile: { id: "profile-1", fullName: "Maya Hamdan" } });
    window.history.pushState({}, "", "/symptoms?voice=1");

    try {
      render(<SymptomsPage />);
      expect(await screen.findByRole("button", { name: "Stop listening" })).toBeInTheDocument();
      expect(recognition.start).toHaveBeenCalledTimes(1);
    } finally {
      window.history.pushState({}, "", "/");
    }
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
      screen.getByLabelText("Symptoms"),
      text
    );
    await user.click(screen.getByRole("button", { name: "Submit symptoms" }));
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
      screen.getByLabelText("Symptoms"),
      "Cough"
    );
    await user.click(screen.getByRole("button", { name: "Submit symptoms" }));

    expect(await screen.findByText("Could not save symptoms.")).toBeInTheDocument();
    expect(classifyUrgency).not.toHaveBeenCalled();
  });

  // ---- SCRUM-126: follow-up questions ----

  test("shows follow-up questions and marks the first result as provisional", async () => {
    classifyUrgency.mockResolvedValue(SOON_WITH_QUESTIONS);

    await submitSymptoms("Fever since yesterday");

    expect(
      await screen.findByRole("heading", { name: "Urgency so far: See a doctor soon" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "What is the highest temperature you measured?" })
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "How bad are the symptoms right now?" })).toBeInTheDocument();
    // Nothing answered yet, so there is nothing to send.
    expect(screen.getByRole("button", { name: "Update my urgency" })).toBeDisabled();
  });

  test("sends the answers with the saved description and shows the updated result", async () => {
    const user = userEvent.setup();
    classifyUrgency.mockResolvedValue(SOON_WITH_QUESTIONS);
    refineUrgency.mockResolvedValue(URGENT_REFINED);

    await submitSymptoms("Fever since yesterday");
    await user.click(await screen.findByLabelText("39.5°C or higher"));
    await user.click(screen.getByRole("button", { name: "Update my urgency" }));

    expect(refineUrgency).toHaveBeenCalledWith("Fever since yesterday", {
      "fever-temperature": "39.5-plus",
    });
    expect(await screen.findByRole("heading", { name: "Urgency: Urgent" })).toBeInTheDocument();
    expect(screen.getByText("Updated using your answers.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "A few quick questions" })).not.toBeInTheDocument();
  });

  test("skipping the questions keeps the first result as the final one", async () => {
    const user = userEvent.setup();
    classifyUrgency.mockResolvedValue(SOON_WITH_QUESTIONS);

    await submitSymptoms("Fever since yesterday");
    await user.click(await screen.findByRole("button", { name: "Skip questions" }));

    expect(screen.getByRole("heading", { name: "Urgency: See a doctor soon" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "A few quick questions" })).not.toBeInTheDocument();
    expect(refineUrgency).not.toHaveBeenCalled();
  });

  test("an emergency shows no questions, only the call-140 advice", async () => {
    classifyUrgency.mockResolvedValue({ ...EMERGENCY_RESULT, followUpQuestions: [] });

    await submitSymptoms("Chest pain");

    expect(await screen.findByRole("alert")).toHaveTextContent("Urgency: Emergency");
    expect(screen.queryByRole("heading", { name: "A few quick questions" })).not.toBeInTheDocument();
  });

  test("if updating fails, the first result and the questions stay so the user can retry", async () => {
    const user = userEvent.setup();
    classifyUrgency.mockResolvedValue(SOON_WITH_QUESTIONS);
    refineUrgency.mockRejectedValue(new Error("Request failed."));

    await submitSymptoms("Fever since yesterday");
    await user.click(await screen.findByLabelText("Severe: I can hardly function"));
    await user.click(screen.getByRole("button", { name: "Update my urgency" }));

    expect(
      await screen.findByText("We could not update the urgency with your answers. The result above still applies.")
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Urgency so far: See a doctor soon" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update my urgency" })).toBeEnabled();
  });
});