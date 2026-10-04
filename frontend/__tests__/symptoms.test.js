import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SymptomsPage from "../pages/symptoms";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { addSymptomRecord } from "../lib/symptomApi";

jest.mock("../context/ActiveProfileContext", () => ({
  useActiveProfile: jest.fn(),
}));

jest.mock("../lib/symptomApi", () => ({
  addSymptomRecord: jest.fn(),
}));

describe("Symptoms Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});