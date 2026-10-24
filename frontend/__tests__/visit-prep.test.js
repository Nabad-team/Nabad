import { render, screen, within } from "@testing-library/react";
import VisitPrepPage from "../pages/visit-prep";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";
import { getHealthProfile } from "../lib/healthProfileApi";
import { getSymptomsForProfile } from "../lib/symptomApi";

jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
jest.mock("../lib/healthProfileApi", () => ({ getHealthProfile: jest.fn() }));
jest.mock("../lib/symptomApi", () => ({ getSymptomsForProfile: jest.fn() }));
jest.mock("../components/SessionTimeout", () => ({
  ...jest.requireActual("../components/SessionTimeout"),
  useSessionStatus: () => "signedIn",
  useSignedIn: () => true,
}));

function renderPage() {
  return render(<ActiveProfileProvider><VisitPrepPage /></ActiveProfileProvider>);
}

describe("Visit preparation page", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
    getHealthProfile.mockReset().mockResolvedValue({ dateOfBirth: "1990-04-12", age: { years: 36, text: "36 years" }, facts: [] });
    getSymptomsForProfile.mockReset().mockResolvedValue([]);
  });

  test("loads the active profile's history and includes allergy type and reaction", async () => {
    getHealthProfile.mockResolvedValue({
      dateOfBirth: "1990-04-12",
      age: { years: 36, text: "36 years" },
      facts: [
        { id: "allergy-1", category: "allergy", value: { type: "medication", name: "Penicillin", reaction: "Hives" } },
        { id: "condition-1", category: "condition", value: { code: "asthma" } },
      ],
      suggestions: [{ id: "suggested-1", category: "condition", value: { code: "diabetes" }, status: "suggested" }],
    });
    getSymptomsForProfile.mockResolvedValue([{
      id: "symptom-1",
      symptoms: "Headache since yesterday",
      createdAt: "2026-10-20T10:30:00.000Z",
      urgencyResult: { label: "Needs attention soon" },
      conversation: [
        { role: "patient", content: "Headache since yesterday" },
        { role: "assistant", content: "Saved result" },
        { role: "patient", content: "Pain level: moderate" },
        { role: "assistant", content: "Follow-up saved" },
      ],
    }]);

    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Visit preparation" })).toBeInTheDocument();
    expect(await screen.findByText("Penicillin (Medication; reaction: Hives)")).toBeInTheDocument();
    expect(getHealthProfile).toHaveBeenCalledWith("self");
    expect(getSymptomsForProfile).toHaveBeenCalledWith("self");
    expect(screen.getByText("Asthma")).toBeInTheDocument();
    expect(screen.queryByText("Diabetes")).not.toBeInTheDocument();
    const symptomList = await screen.findByRole("list", { name: "Recent symptom checks" });
    expect(within(symptomList).getByText("Headache since yesterday")).toBeInTheDocument();
    expect(within(symptomList).getByText("Pain level: moderate")).toBeInTheDocument();
    expect(within(symptomList).getByText(/Needs attention soon/)).toBeInTheDocument();
  });

  test("shows a clear empty state when no health facts or symptom checks are saved", async () => {
    renderPage();

    expect(await screen.findByText(/No confirmed conditions, allergies or other background information recorded/)).toBeInTheDocument();
    expect(screen.getByText("No saved symptom checks yet.")).toBeInTheDocument();
  });

  test("requests both summaries for the selected linked profile", async () => {
    const child = await fakeProfileApi.addLinkedProfile({ fullName: "Sami Haddad", dateOfBirth: "2018-04-02", relationship: "child" });
    localStorage.setItem("nabad-active-profile-id", child.id);
    getHealthProfile.mockResolvedValue({ dateOfBirth: "2018-04-02", age: { years: 8, text: "8 years" }, facts: [] });

    renderPage();

    expect(await screen.findByText("Sami Haddad")).toBeInTheDocument();
    expect(await screen.findByText("No saved symptom checks yet.")).toBeInTheDocument();
    expect(getHealthProfile).toHaveBeenCalledWith(child.id);
    expect(getSymptomsForProfile).toHaveBeenCalledWith(child.id);
  });
});
