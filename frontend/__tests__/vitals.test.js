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
  // Data first: the form opens from "Log reading" and takes focus.
  expect(screen.queryByLabelText("Heart rate (bpm)")).not.toBeInTheDocument();
  const logButton = screen.getByRole("button", { name: "Log reading" });
  await user.click(logButton);
  expect(logButton).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("region", { name: "Log a reading" })).toBeInTheDocument();
  expect(screen.getByLabelText("Systolic (mmHg)")).toHaveFocus();
  await user.type(screen.getByLabelText("Heart rate (bpm)"), "75");
  await user.click(screen.getByRole("button", { name: "Save reading" }));
  await waitFor(() => expect(addVital).toHaveBeenCalledWith("self", expect.objectContaining({ heartRate: 75 })));
  expect(await screen.findByRole("status")).toHaveTextContent("Vital reading saved.");
  expect(screen.queryByRole("region", { name: "Log a reading" })).not.toBeInTheDocument();
  await waitFor(() => expect(logButton).toHaveFocus());
});

test("Cancel and Escape close the form without saving", async () => {
  const user = userEvent.setup({ delay: null });
  render(<VitalsPage />);
  await screen.findByText("120/80 mmHg");
  await user.click(screen.getByRole("button", { name: "Log reading" }));
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("region", { name: "Log a reading" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Log reading" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("region", { name: "Log a reading" })).not.toBeInTheDocument();
  expect(addVital).not.toHaveBeenCalled();
});

test("the empty state offers Log reading, and Review vitals before a visit is under More", async () => {
  listVitals.mockResolvedValue({ readings: [] });
  const user = userEvent.setup({ delay: null });
  const { unmount } = render(<VitalsPage />);
  expect(await screen.findByText("No vital readings in this range yet: log a reading, or choose a wider time range.")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Log reading" })).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "More" })).not.toBeInTheDocument();
  unmount();
  listVitals.mockResolvedValue({ readings: [sample] });
  render(<VitalsPage />);
  await screen.findByText("120/80 mmHg");
  await user.click(screen.getByRole("button", { name: "More" }));
  expect(screen.getByRole("link", { name: "Review vitals before a visit" })).toHaveAttribute("href", "/visit-prep");
});

test("rounds the change between readings", async () => {
  listVitals.mockResolvedValue({ readings: [{ ...sample, id: "b", temperature: 36.8 }, { ...sample, id: "a", recordedAt: "2026-11-02T08:30:00.000Z", temperature: 36.7 }] });
  render(<VitalsPage />);
  expect(await screen.findByText("Latest temperature is 0.1 °C higher than the previous reading.")).toBeInTheDocument();
});
