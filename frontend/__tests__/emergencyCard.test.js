import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmergencyCardPage from "../pages/emergency-card";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { getEmergencyCard } from "../lib/emergencyCardApi";

jest.mock("../context/ActiveProfileContext", () => ({ useActiveProfile: jest.fn() }));
jest.mock("../lib/emergencyCardApi", () => ({ getEmergencyCard: jest.fn() }));
jest.mock("../components/ProfileHeader", () => () => <header>Navigation</header>);
const CARD = {
  profile: { id: "self", fullName: "Card Patient", dateOfBirth: "1990-04-12" }, preparedAt: "2026-10-31T10:00:00Z", bloodType: "O+",
  conditions: [{ code: "asthma" }, { code: "other", text: "A recorded condition" }],
  allergies: [{ name: "Penicillin", type: "medication", reaction: "Hives" }],
  medications: [{ name: "Example medicine", dose: "5", unit: "mg", form: "tablet", frequency: "Once daily" }],
  emergencyContact: { name: "Emergency Person", phone: "+96170123456" },
};
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
beforeEach(() => {
  jest.resetAllMocks();
  useActiveProfile.mockReturnValue({ activeProfile: { id: "self", fullName: "Card Patient" } });
  getEmergencyCard.mockResolvedValue(CARD);
  jest.spyOn(window, "print").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test("the private card displays patient identity and every required health section, then prints", async () => {
  const user = userEvent.setup(); render(<EmergencyCardPage />);
  expect(EmergencyCardPage.requireSignIn).toBe(true);
  const card = await screen.findByRole("article", { name: "Emergency information card for Card Patient" });
  for (const text of ["Asthma", "A recorded condition", "Penicillin", "Example medicine", "Emergency Person", "O+"]) expect(within(card).getByText(text)).toBeInTheDocument();
  expect(card).toHaveTextContent("12 Apr 1990");
  expect(card).toHaveTextContent("Reaction: Hives");
  expect(card).toHaveTextContent("Dose: 5 mg");
  expect(card).toHaveTextContent("Frequency: Once daily");
  expect(within(card).getByRole("link", { name: "+96170123456" })).toHaveAttribute("href", "tel:+96170123456");
  await user.click(screen.getByRole("button", { name: "Print emergency card" }));
  expect(window.print).toHaveBeenCalledTimes(1);
  expect(getEmergencyCard).toHaveBeenCalledWith("self", expect.any(AbortSignal));
});
test("empty fields mean not recorded, not proof of no allergies or conditions", async () => {
  getEmergencyCard.mockResolvedValue({ ...CARD, profile: { ...CARD.profile, dateOfBirth: "" }, bloodType: "unknown", conditions: [], allergies: [], medications: [], emergencyContact: null });
  render(<EmergencyCardPage />);
  const card = await screen.findByRole("article");
  expect(card).toHaveTextContent("Date of birth: Not recorded");
  expect(card).toHaveTextContent("Blood type: Unknown");
  expect(card).toHaveTextContent("No medical conditions recorded.");
  expect(card).toHaveTextContent("This does not confirm there are no known allergies.");
  expect(card).toHaveTextContent("No active medications recorded.");
  expect(card).toHaveTextContent("No emergency contact recorded for this profile.");
});
test("a unit without a dose is not presented as a recorded dose", async () => {
  getEmergencyCard.mockResolvedValue({ ...CARD, medications: [{ name: "Incomplete medicine", dose: "", unit: "mg", form: "other", frequency: "" }] });
  render(<EmergencyCardPage />);
  const card = await screen.findByRole("article");
  expect(card).toHaveTextContent("Dose: Not recorded");
  expect(card).toHaveTextContent("Frequency: Not recorded");
  expect(card).not.toHaveTextContent("Dose: mg");
});
test("failed or pending loading cannot print a misleading partial card; refresh retries", async () => {
  const loading = deferred(); getEmergencyCard.mockReturnValueOnce(loading.promise);
  const user = userEvent.setup(); render(<EmergencyCardPage />);
  expect(screen.getByRole("button", { name: "Print emergency card" })).toBeDisabled();
  getEmergencyCard.mockRejectedValueOnce(new Error("offline"));
  await user.click(screen.getByRole("button", { name: "Refresh card" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load");
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Print emergency card" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Refresh card" }));
  expect(await screen.findByRole("article")).toBeInTheDocument();
});
test("profile switching hides the previous card immediately and rejects late data", async () => {
  const late = deferred();
  const user = userEvent.setup(); const view = render(<EmergencyCardPage />);
  await screen.findByRole("article");
  getEmergencyCard.mockReturnValueOnce(late.promise);
  await user.click(screen.getByRole("button", { name: "Refresh card" }));
  const child = { ...CARD, profile: { id: "child", fullName: "Child Patient", dateOfBirth: "2020-01-01" }, conditions: [], allergies: [], medications: [], emergencyContact: null };
  getEmergencyCard.mockResolvedValue(child);
  useActiveProfile.mockReturnValue({ activeProfile: { id: "child", fullName: "Child Patient" } });
  view.rerender(<EmergencyCardPage />);
  expect(screen.queryByText("Card Patient")).not.toBeInTheDocument();
  await screen.findByRole("article", { name: /Child Patient/ });
  await act(async () => late.resolve(CARD));
  expect(screen.queryByText("Card Patient")).not.toBeInTheDocument();
  expect(screen.queryByText("Emergency Person")).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Update emergency contact" })).not.toBeInTheDocument();
});
test("a missing profile or a mismatched response cannot expose or print a card", async () => {
  useActiveProfile.mockReturnValue({ activeProfile: null });
  const view = render(<EmergencyCardPage />);
  expect(screen.getByText(/Select a profile/)).toBeInTheDocument();
  expect(getEmergencyCard).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Print emergency card" })).toBeDisabled();
  useActiveProfile.mockReturnValue({ activeProfile: { id: "child" } });
  view.rerender(<EmergencyCardPage />);
  await screen.findByRole("alert");
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});
test("patient-entered conditions are rendered as text rather than executable markup", async () => {
  const text = '<img src=x onerror="alert(1)">';
  getEmergencyCard.mockResolvedValue({ ...CARD, conditions: [{ code: "other", text }] });
  render(<EmergencyCardPage />);
  const card = await screen.findByRole("article");
  expect(within(card).getByText(text)).toBeInTheDocument();
  expect(card.querySelector("img")).toBeNull();
});
