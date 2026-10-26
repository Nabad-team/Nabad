// SCRUM-280: "As a user, I want adaptive follow-up questions: the AI picks the next most useful question from an
// approved question bank, up to 3 rounds, and stops once it is confident." The page side: one question per round,
// every answer so far sent with the last followUpState, and each answer saved to the conversation once.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SymptomsPage from "../pages/symptoms";
import FollowUpQuestions from "../components/FollowUpQuestions";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { addSymptomRecord, updateSymptomRecord } from "../lib/symptomApi";
import { assessUrgency, assessUrgencyWithAnswers } from "../lib/triageApi";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

jest.setTimeout(PAGE_FLOW_TIMEOUT);

jest.mock("../context/ActiveProfileContext", () => ({ useActiveProfile: jest.fn() }));
jest.mock("../lib/symptomApi", () => ({
  addSymptomRecord: jest.fn(),
  getSymptomsForProfile: jest.fn().mockResolvedValue([]),
  updateSymptomRecord: jest.fn(),
}));
jest.mock("../lib/triageApi", () => ({ assessUrgency: jest.fn(), assessUrgencyWithAnswers: jest.fn(), newCheckId: () => "check-test" }));

const TEMPERATURE = {
  id: "fever-temperature",
  text: "What is the highest temperature you measured?",
  options: [{ value: "under-38", label: "Below 38°C" }, { value: "39.5-plus", label: "39.5°C or higher" }],
};
const SEVERITY = {
  id: "severity",
  text: "How bad are the symptoms right now?",
  options: [{ value: "mild", label: "Mild: I can do my normal activities" }, { value: "severe", label: "Severe: I can hardly function" }],
};
const base = {
  label: "See a doctor soon",
  timeframe: "Within 24 to 48 hours",
  action: "Book an appointment with a doctor in the next day or two.",
  reasons: ["A fever should be checked by a doctor if it lasts or gets worse."],
  disclaimer: "This is guidance, not a diagnosis. If you think it is an emergency, call 140 now.",
};
const state = (round, asked, extra = {}) => ({ round, maxRounds: 3, asked, oneAtATime: true, done: false, decision: "model_pick", ...extra });
const ROUND_1 = { ...base, level: "soon", followUpQuestions: [TEMPERATURE], followUpState: state(1, ["fever-temperature"]) };
const ROUND_2 = { ...base, level: "urgent", label: "Urgent", followUpQuestions: [SEVERITY], followUpState: state(2, ["fever-temperature", "severity"]) };
const DONE = { ...base, level: "urgent", label: "Urgent", followUpQuestions: [], followUpState: state(2, ["fever-temperature", "severity"], { done: true, decision: "model_confident" }) };

beforeEach(() => {
  jest.clearAllMocks();
  useActiveProfile.mockReturnValue({ activeProfile: { id: "profile-1", fullName: "Maya Hamdan" } });
  addSymptomRecord.mockResolvedValue({ id: "symptom-1" });
  updateSymptomRecord.mockResolvedValue({ id: "symptom-1" });
});

test("asks one question per round and stops when the server says it is done", async () => {
  const user = userEvent.setup();
  assessUrgency.mockResolvedValue(ROUND_1);
  assessUrgencyWithAnswers.mockResolvedValueOnce(ROUND_2).mockResolvedValueOnce(DONE);
  render(<SymptomsPage />);

  await user.type(screen.getByLabelText("Symptoms"), "I have a fever");
  await user.click(screen.getByRole("button", { name: "Submit symptoms" }));

  // Round 1
  expect(await screen.findByRole("heading", { name: "A quick question" })).toBeInTheDocument();
  expect(screen.getByText(/Question 1 of at most 3/)).toBeInTheDocument();
  await user.click(screen.getByLabelText("39.5°C or higher"));
  await user.click(screen.getByRole("button", { name: "Update my urgency" }));

  // Round 2: the server got the first answer and the first round's state.
  expect(await screen.findByText(/Question 2 of at most 3/)).toBeInTheDocument();
  expect(assessUrgencyWithAnswers).toHaveBeenLastCalledWith("I have a fever", { "fever-temperature": "39.5-plus" }, "profile-1", "check-test", ROUND_1.followUpState);
  expect(screen.getByRole("radio", { name: "Mild: I can do my normal activities" })).not.toBeChecked();
  await user.click(screen.getByLabelText("Severe: I can hardly function"));
  await user.click(screen.getByRole("button", { name: "Update my urgency" }));

  // Done: every answer so far went with the second round's state, and no more questions show.
  await waitFor(() => expect(assessUrgencyWithAnswers).toHaveBeenCalledTimes(2));
  expect(assessUrgencyWithAnswers).toHaveBeenLastCalledWith(
    "I have a fever", { "fever-temperature": "39.5-plus", severity: "severe" }, "profile-1", "check-test", ROUND_2.followUpState,
  );
  await waitFor(() => expect(screen.queryByRole("heading", { name: /quick question/ })).not.toBeInTheDocument());
  expect(await screen.findByRole("heading", { name: "Urgency: Urgent" })).toBeInTheDocument();

  // The saved conversation gets each answer once: only that round's answer each time.
  expect(updateSymptomRecord.mock.calls.map((call) => call[2])).toEqual([{ "fever-temperature": "39.5-plus" }, { severity: "severe" }]);
});

test("skipping ends the questions, and a new check starts again from round 1 with no old answers", async () => {
  const user = userEvent.setup();
  assessUrgency.mockResolvedValueOnce(ROUND_1);
  assessUrgencyWithAnswers.mockResolvedValueOnce(ROUND_2);
  render(<SymptomsPage />);
  await user.type(screen.getByLabelText("Symptoms"), "I have a fever");
  await user.click(screen.getByRole("button", { name: "Submit symptoms" }));
  await user.click(await screen.findByLabelText("39.5°C or higher"));
  await user.click(screen.getByRole("button", { name: "Update my urgency" }));
  await user.click(await screen.findByRole("button", { name: "Skip questions" }));
  expect(screen.queryByRole("heading", { name: "A quick question" })).not.toBeInTheDocument();
  expect(assessUrgencyWithAnswers).toHaveBeenCalledTimes(1);

  // A new check: its first question is about severity, and the old temperature answer must not come along.
  const NEW_CHECK = { ...ROUND_1, followUpQuestions: [SEVERITY], followUpState: state(1, ["severity"]) };
  assessUrgency.mockResolvedValueOnce(NEW_CHECK);
  assessUrgencyWithAnswers.mockResolvedValueOnce(DONE);
  await user.type(screen.getByLabelText("Symptoms"), "a headache now");
  await user.click(screen.getByRole("button", { name: "Submit symptoms" }));
  expect(await screen.findByText(/Question 1 of at most 3/)).toBeInTheDocument();
  await user.click(screen.getByLabelText("Mild: I can do my normal activities"));
  await user.click(screen.getByRole("button", { name: "Update my urgency" }));
  await waitFor(() => expect(assessUrgencyWithAnswers).toHaveBeenCalledTimes(2));
  expect(assessUrgencyWithAnswers).toHaveBeenLastCalledWith("a headache now", { severity: "mild" }, "profile-1", "check-test", NEW_CHECK.followUpState);
});

describe("the question card", () => {
  test("several questions at once (AI off) keep the original wording", () => {
    render(<FollowUpQuestions questions={[TEMPERATURE, SEVERITY]} onSubmit={jest.fn()} onSkip={jest.fn()} progress={state(3, [], { oneAtATime: false, decision: "rules_all" })} />);
    expect(screen.getByRole("heading", { name: "A few quick questions" })).toBeInTheDocument();
    expect(screen.getByText(/Skip any you are not sure about/)).toBeInTheDocument();
    expect(screen.queryByText(/of at most 3/)).not.toBeInTheDocument();
  });

  test("without progress (an older server) it looks as before", () => {
    render(<FollowUpQuestions questions={[TEMPERATURE]} onSubmit={jest.fn()} onSkip={jest.fn()} />);
    expect(screen.getByRole("heading", { name: "A few quick questions" })).toBeInTheDocument();
  });
});
