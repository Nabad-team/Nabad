import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VitalsPage from "../pages/vitals";
import { addVital, listVitals } from "../lib/vitalsApi";

jest.mock("../components/ProfileHeader", () => () => <div />);
jest.mock("../context/ActiveProfileContext", () => ({ useActiveProfile: () => ({ activeProfile: { id: "self", fullName: "Rana", isSelf: true }, error: "" }) }));
jest.mock("../lib/vitalsApi", () => ({ listVitals: jest.fn(), addVital: jest.fn(), deleteVital: jest.fn() }));

const sample = { id: "one", recordedAt: "2026-11-03T08:30:00.000Z", systolic: 120, diastolic: 80, heartRate: 72, temperature: 36.7 };
beforeEach(() => {
  listVitals.mockReset().mockResolvedValue({ readings: [sample] });
  addVital.mockReset().mockResolvedValue(sample);
});

test("shows history, units and accessible trend charts", async () => {
  render(<VitalsPage />);
  expect(await screen.findByText("120/80 mmHg")).toBeInTheDocument();
  expect(screen.getByText("72 bpm")).toBeInTheDocument();
  expect(screen.getByText("36.7°C")).toBeInTheDocument();
  expect(screen.getByRole("group", { name: /Blood pressure values/ })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /Systolic: 120 mmHg/ })).toHaveAttribute("tabindex", "0");
  expect(listVitals).toHaveBeenCalledWith("self", "30");
});

test("changes range and logs a partial reading", async () => {
  const user = userEvent.setup({ delay: null });
  render(<VitalsPage />);
  await screen.findByText("120/80 mmHg");
  await user.selectOptions(screen.getByLabelText("Time range"), "7");
  await waitFor(() => expect(listVitals).toHaveBeenCalledWith("self", "7"));
  await user.type(screen.getByLabelText("Heart rate (bpm)"), "75");
  await user.click(screen.getByRole("button", { name: "Save reading" }));
  await waitFor(() => expect(addVital).toHaveBeenCalledWith("self", expect.objectContaining({ heartRate: 75 })));
  expect(await screen.findByRole("status")).toHaveTextContent("Vital reading saved.");
});
