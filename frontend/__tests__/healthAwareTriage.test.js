// SCRUM-279: "As a user, Triage uses the My health summary (age, pregnancy, conditions, allergies) and never
// asks what Nabad already knows." The page side: the explanation says when My health made the result more
// urgent, and the symptoms page and privacy policy say the My health summary is sent to the AI.
import { render, screen } from "@testing-library/react";
import UrgencyExplanation from "../components/UrgencyExplanation";
import PrivacyPolicy from "../pages/privacy";
import SymptomsPage from "../pages/symptoms";
import { useActiveProfile } from "../context/ActiveProfileContext";

jest.mock("../context/ActiveProfileContext", () => ({ useActiveProfile: jest.fn() }));
jest.mock("../lib/symptomApi", () => ({
  addSymptomRecord: jest.fn(),
  getSymptomsForProfile: jest.fn().mockResolvedValue([]),
  updateSymptomRecord: jest.fn(),
}));
jest.mock("../lib/triageApi", () => ({ assessUrgency: jest.fn(), assessUrgencyWithAnswers: jest.fn(), newCheckId: () => "check-test" }));

const FROM_MY_HEALTH = "My health shows a pregnancy, so symptoms should be checked sooner.";
const EXPLANATION = {
  summary: "We suggest seeing a doctor in the next day or two because My health shows a reason to check your symptoms sooner.",
  triggers: [],
  changedBy: [],
  fromMyHealth: [FROM_MY_HEALTH],
  notCounted: [],
  watchFor: ["See a doctor if your symptoms last more than a few days or get worse."],
  basedOn: "Nabad's safety rules, which look for known warning signs in what you wrote. What you recorded in My health was taken into account too.",
};

describe("the explanation with My health", () => {
  test("lists what My health shows that made it more urgent", () => {
    render(<UrgencyExplanation explanation={EXPLANATION} />);
    expect(screen.getByText("From My health:")).toBeInTheDocument();
    expect(screen.getByText(FROM_MY_HEALTH)).toBeInTheDocument();
    expect(screen.getByText(/What you recorded in My health was taken into account too/)).toBeInTheDocument();
  });

  test("simplified mode keeps only the one-sentence summary", () => {
    render(<UrgencyExplanation explanation={EXPLANATION} simplified />);
    expect(screen.getByText(EXPLANATION.summary)).toBeInTheDocument();
    expect(screen.queryByText("From My health:")).not.toBeInTheDocument();
  });

  test("an explanation without the field (an older saved result) still shows", () => {
    const { fromMyHealth, ...older } = EXPLANATION;
    render(<UrgencyExplanation explanation={older} />);
    expect(screen.getByText(EXPLANATION.summary)).toBeInTheDocument();
    expect(screen.queryByText("From My health:")).not.toBeInTheDocument();
  });
});

describe("privacy policy", () => {
  test("says the My health summary is sent to the AI and is the text shown on My health", () => {
    const { container } = render(<PrivacyPolicy />);
    expect(container).toHaveTextContent("the My health summary of the person the check is for is sent with it");
    expect(container).toHaveTextContent("It is exactly the text shown under \"What Nabad's guidance takes into account\" on the My health page");
    expect(container).toHaveTextContent("Your name, email, date of birth and account details are not sent");
  });
});

describe("symptoms page notice", () => {
  test("says the description goes to the AI with the My health summary, after the safety rules use it", () => {
    useActiveProfile.mockReturnValue({ activeProfile: { id: "self", fullName: "Rana", type: "self" } });
    render(<SymptomsPage />);
    expect(screen.getByText(/using what you saved in My health, then sent over an encrypted connection to Google's Gemini AI service to help assess urgency, together with your My health summary/)).toBeInTheDocument();
  });
});
