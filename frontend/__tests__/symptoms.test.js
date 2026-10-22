import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import SymptomsPage from "../pages/symptoms";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { addSymptomRecord, getSymptomsForProfile } from "../lib/symptomApi";
import { assessUrgency, assessUrgencyWithAnswers } from "../lib/triageApi";
import { getEmergencyContact } from "../lib/api";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

// Full-page flows: slow under load for a good reason (see test-utils/timeouts.js).
jest.setTimeout(PAGE_FLOW_TIMEOUT);

jest.mock("../context/ActiveProfileContext", () => ({
  useActiveProfile: jest.fn(),
}));

jest.mock("../lib/symptomApi", () => ({
  addSymptomRecord: jest.fn(),
  getSymptomsForProfile: jest.fn().mockResolvedValue([]),
  updateSymptomRecord: jest.fn().mockResolvedValue({ id: "symptom-1" }),
}));

// SCRUM-128: the page asks the backend for an urgency level before saving the symptom record.
jest.mock("../lib/triageApi", () => ({
  assessUrgency: jest.fn(),
  assessUrgencyWithAnswers: jest.fn(),
  newCheckId: () => "check-test",
}));

jest.mock("../lib/api", () => ({
  ...jest.requireActual("../lib/api"),
  getEmergencyContact: jest.fn(),
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

const ROUTINE_RESULT = {
  level: "routine",
  label: "Routine / self-care",
  timeframe: "Within a few days, if it does not improve",
  action:
    "Rest and monitor your symptoms. Book a regular appointment if they last more than a few days or get worse.",
  reasons: [
    "Mild, common symptoms like these can usually be managed at home.",
  ],
  selfCareGuidance: [
    "Rest and avoid strenuous activity while you are feeling unwell.",
    "Drink enough fluids unless a healthcare professional has told you to limit fluids.",
    "Monitor your symptoms and how you are feeling.",
    "Seek medical advice if your symptoms worsen, do not improve, or you become concerned.",
  ],
  disclaimer:
    "This is guidance, not a diagnosis. If you think it is an emergency, call 140 now.",
};

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

    assessUrgency.mockResolvedValue(SOON_RESULT);
    addSymptomRecord.mockResolvedValue({ id: "symptom-1" });
    getEmergencyContact.mockResolvedValue({ contact: null });
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

  test("shows saved symptom conversation turns for later review", async () => {
    useActiveProfile.mockReturnValue({ activeProfile: { id: "profile-1", fullName: "Maya Hamdan" } });
    getSymptomsForProfile.mockResolvedValue([{
      id: "saved-check", createdAt: "2026-10-18T09:00:00.000Z", description: "Past cough",
      urgencyResult: SOON_RESULT,
      conversation: [
        { role: "patient", content: "Past cough" },
        { role: "assistant", content: "Please answer this question." },
        { role: "patient", content: "I said the cough is getting worse." },
      ],
    }]);

    render(<SymptomsPage />);
    const summary = await screen.findByText(/See a doctor soon/);
    expect(summary.closest("summary")).toHaveTextContent("See a doctor soon");
    await userEvent.setup().click(summary.closest("summary"));
    expect(screen.getByText(/I said the cough is getting worse/)).toBeInTheDocument();
  });

  test("does not submit when symptoms are empty", async () => {
    const user = userEvent.setup({ delay: null });

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
    expect(assessUrgency).not.toHaveBeenCalled();
  });

  test("saves symptoms for the selected linked profile", async () => {
    const user = userEvent.setup({ delay: null });

    useActiveProfile.mockReturnValue({
      activeProfile: {
        id: "profile-1",
        fullName: "Maya Hamdan",
      },
    });

    assessUrgency.mockResolvedValue(SOON_RESULT);

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
      expect(assessUrgency).toHaveBeenCalledWith("Fever and headache", "profile-1", expect.any(String));

      expect(addSymptomRecord).toHaveBeenCalledWith(
        "profile-1",
        "Maya Hamdan",
        "Fever and headache",
        SOON_RESULT
      );
    });
  });

  test("shows confirmation after symptoms are saved", async () => {
    const user = userEvent.setup({ delay: null });

    useActiveProfile.mockReturnValue({
      activeProfile: {
        id: "profile-1",
        fullName: "Maya Hamdan",
      },
    });

    assessUrgency.mockResolvedValue(SOON_RESULT);

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
    const user = userEvent.setup({ delay: null });
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
    const recognition = {
      start: jest.fn(),
      stop: jest.fn(),
      abort: jest.fn(),
    };

    window.SpeechRecognition = jest.fn(() => recognition);

    useActiveProfile.mockReturnValue({
      activeProfile: {
        id: "profile-1",
        fullName: "Maya Hamdan",
      },
    });

    window.history.pushState({}, "", "/symptoms?voice=1");

    try {
      render(<SymptomsPage />);

      expect(
        await screen.findByRole("button", { name: "Stop listening" })
      ).toBeInTheDocument();

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

  test("tells the user the description is sent to Google's Gemini AI and links to the privacy policy", () => {
    useActiveProfile.mockReturnValue({
      activeProfile: {
        id: "profile-1",
        fullName: "Maya Hamdan",
      },
    });

    render(<SymptomsPage />);

    expect(screen.getByText(/sent over an encrypted connection to Google's Gemini AI service to help assess urgency/)).toBeInTheDocument();
    expect(screen.getByText(/checked by Nabad's safety rules first/)).toBeInTheDocument();
    expect(screen.getByText(/doesn't write your description to its logs/)).toBeInTheDocument();
    expect(screen.queryByText(/train AI/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How this works" })).toHaveAttribute("href", "/privacy#ai-symptom-check");
  });

  // ---- SCRUM-128: urgency classification ----

  async function submitSymptoms(text) {
    const user = userEvent.setup({ delay: null });

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
      text
    );

    await user.click(
      screen.getByRole("button", { name: "Submit symptoms" })
    );
  }

  test("classifies the symptoms and shows how soon to get care", async () => {
    assessUrgency.mockResolvedValue(SOON_RESULT);

    await submitSymptoms("Fever and headache");

    expect(assessUrgency).toHaveBeenCalledWith("Fever and headache", "profile-1", expect.any(String));

    expect(
      await screen.findByRole("heading", {
        name: "Urgency: See a doctor soon",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Within 24 to 48 hours")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "A fever should be checked by a doctor if it lasts or gets worse."
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: "Call 140 now" })
    ).not.toBeInTheDocument();

    expect(addSymptomRecord).toHaveBeenCalledWith(
      "profile-1",
      "Maya Hamdan",
      "Fever and headache",
      SOON_RESULT
    );
  });

  test("an emergency result is announced as an alert with a call button", async () => {
    assessUrgency.mockResolvedValue(EMERGENCY_RESULT);

    await submitSymptoms("Chest pain");

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent("Urgency: Emergency");

    expect(
      screen.getByRole("link", { name: "Call 140 now" })
    ).toHaveAttribute("href", "tel:140");

    expect(addSymptomRecord).toHaveBeenCalledWith(
      "profile-1",
      "Maya Hamdan",
      "Chest pain",
      EMERGENCY_RESULT
    );
  });

  test("shows the saved emergency contact when the result is an emergency", async () => {
    getEmergencyContact.mockResolvedValue({
      contact: {
        name: "Rana Hamdan",
        phone: "+961 70 123 456",
      },
    });

    assessUrgency.mockResolvedValue(EMERGENCY_RESULT);

    await submitSymptoms("Chest pain");

    expect(
      await screen.findByRole("heading", {
        name: "Your emergency contact",
      })
    ).toBeInTheDocument();

    expect(screen.getByText("Rana Hamdan")).toBeInTheDocument();
    expect(screen.getByText("+961 70 123 456")).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Call Rana Hamdan",
      })
    ).toHaveAttribute("href", "tel:+96170123456");

    expect(getEmergencyContact).toHaveBeenCalledTimes(1);
  });

  test("shows self-care guidance for a routine result", async () => {
    assessUrgency.mockResolvedValue(ROUTINE_RESULT);

    await submitSymptoms("Runny nose");

    expect(
      await screen.findByRole("heading", {
        name: "Urgency: Routine / self-care",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Self-care guidance",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Rest and avoid strenuous activity while you are feeling unwell."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Drink enough fluids unless a healthcare professional has told you to limit fluids."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("Monitor your symptoms and how you are feeling.")
    ).toBeInTheDocument();
  });

  test("if urgency classification fails, symptoms are not saved", async () => {
    assessUrgency.mockRejectedValue(
      new Error("Request failed.")
    );

    await submitSymptoms("Cough");

    expect(
      await screen.findByText(
        "We could not check and save your symptoms right now. If you feel very unwell, call 140."
      )
    ).toBeInTheDocument();

    expect(addSymptomRecord).not.toHaveBeenCalled();

    expect(
      screen.queryByRole("heading", { name: /Urgency:/ })
    ).not.toBeInTheDocument();
  });

  test("if saving fails after assessment, the user sees an error", async () => {
    const user = userEvent.setup({ delay: null });

    useActiveProfile.mockReturnValue({
      activeProfile: {
        id: "profile-1",
        fullName: "Maya Hamdan",
      },
    });

    assessUrgency.mockResolvedValue(SOON_RESULT);
    addSymptomRecord.mockRejectedValue(new Error("disk full"));

    render(<SymptomsPage />);

    await user.type(
      screen.getByLabelText("Symptoms"),
      "Cough"
    );

    await user.click(
      screen.getByRole("button", { name: "Submit symptoms" })
    );

    expect(assessUrgency).toHaveBeenCalledWith("Cough", "profile-1", expect.any(String));

    expect(
      await screen.findByText(
        "We could not check and save your symptoms right now. If you feel very unwell, call 140."
      )
    ).toBeInTheDocument();
  });

  // ---- SCRUM-126: follow-up questions ----

  test("shows follow-up questions and marks the first result as provisional", async () => {
    assessUrgency.mockResolvedValue(SOON_WITH_QUESTIONS);

    await submitSymptoms("Fever since yesterday");

    expect(
      await screen.findByRole("heading", {
        name: "Urgency so far: See a doctor soon",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("group", {
        name: "What is the highest temperature you measured?",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("group", {
        name: "How bad are the symptoms right now?",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Update my urgency" })
    ).toBeDisabled();
  });

  test("sends the answers with the saved description and shows the updated result", async () => {
    const user = userEvent.setup({ delay: null });

    assessUrgency.mockResolvedValue(SOON_WITH_QUESTIONS);
    assessUrgencyWithAnswers.mockResolvedValue(URGENT_REFINED);

    await submitSymptoms("Fever since yesterday");

    await user.click(
      await screen.findByLabelText("39.5°C or higher")
    );

    await user.click(
      screen.getByRole("button", { name: "Update my urgency" })
    );

    expect(
      assessUrgencyWithAnswers
    ).toHaveBeenCalledWith(
      "Fever since yesterday",
      {
        "fever-temperature": "39.5-plus",
      },
      "profile-1",
      "check-test"
    );

    expect(
      await screen.findByRole("heading", {
        name: "Urgency: Urgent",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Updated using your answers.")
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        name: "A few quick questions",
      })
    ).not.toBeInTheDocument();
  });

  test("skipping the questions keeps the first result as the final one", async () => {
    const user = userEvent.setup({ delay: null });

    assessUrgency.mockResolvedValue(SOON_WITH_QUESTIONS);

    await submitSymptoms("Fever since yesterday");

    await user.click(
      await screen.findByRole("button", { name: "Skip questions" })
    );

    expect(
      screen.getByRole("heading", {
        name: "Urgency: See a doctor soon",
      })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        name: "A few quick questions",
      })
    ).not.toBeInTheDocument();

    expect(
      assessUrgencyWithAnswers
    ).not.toHaveBeenCalled();
  });

  test("an emergency shows no questions, only the call-140 advice", async () => {
    assessUrgency.mockResolvedValue({
      ...EMERGENCY_RESULT,
      followUpQuestions: [],
    });

    await submitSymptoms("Chest pain");

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Urgency: Emergency");

    expect(
      screen.queryByRole("heading", {
        name: "A few quick questions",
      })
    ).not.toBeInTheDocument();
  });

  test("if updating fails, the first result and the questions stay so the user can retry", async () => {
    const user = userEvent.setup({ delay: null });

    assessUrgency.mockResolvedValue(SOON_WITH_QUESTIONS);

    assessUrgencyWithAnswers.mockRejectedValue(
      new Error("Request failed.")
    );

    await submitSymptoms("Fever since yesterday");

    await user.click(
      await screen.findByLabelText(
        "Severe: I can hardly function"
      )
    );

    await user.click(
      screen.getByRole("button", { name: "Update my urgency" })
    );

    expect(
      await screen.findByText(
        "We could not update the urgency with your answers. The result above still applies."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Urgency so far: See a doctor soon",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Update my urgency" })
    ).toBeEnabled();
  });
});
