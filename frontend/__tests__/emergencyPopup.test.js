import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmergencyAlert from "../components/EmergencyAlert";
import SymptomsPage from "../pages/symptoms";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { assessUrgency, assessUrgencyWithAnswers } from "../lib/triageApi";
import { addSymptomRecord, getSymptomsForProfile, updateSymptomRecord } from "../lib/symptomApi";
import { getEmergencyContact } from "../lib/api";

jest.mock("../context/ActiveProfileContext", () => ({ useActiveProfile: jest.fn() }));
jest.mock("../context/AccessibilityContext", () => ({ useAccessibility: () => ({ preferences: {} }) }));
jest.mock("../lib/triageApi", () => ({ assessUrgency: jest.fn(), assessUrgencyWithAnswers: jest.fn(), newCheckId: () => "popup-check" }));
jest.mock("../lib/symptomApi", () => ({ addSymptomRecord: jest.fn(), getSymptomsForProfile: jest.fn(), updateSymptomRecord: jest.fn() }));
jest.mock("../lib/api", () => ({ ...jest.requireActual("../lib/api"), getEmergencyContact: jest.fn() }));

const EMERGENCY = { level: "emergency", label: "Emergency", timeframe: "Now", action: "Call 140 now.", reasons: [], followUpQuestions: [] };
const SOON = { level: "soon", label: "See a doctor soon", timeframe: "Within 24 to 48 hours", action: "See a doctor soon.", followUpQuestions: [] };
const { RULES, classifyUrgency } = require("../../backend/src/triage/urgency");
const emergencyRules = RULES.filter(rule => rule.level === "emergency");
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
beforeEach(() => {
  jest.clearAllMocks();
  useActiveProfile.mockReturnValue({ activeProfile: { id: "self", fullName: "Test User" } });
  getSymptomsForProfile.mockResolvedValue([]);
  let stored = 0;
  addSymptomRecord.mockImplementation(async () => ({ id: `record-${++stored}` }));
  updateSymptomRecord.mockResolvedValue({ id: "record" });
  getEmergencyContact.mockResolvedValue({ contact: null });
  assessUrgency.mockResolvedValue(EMERGENCY);
});
async function submit(user, description = "Chest pain today") {
  await user.type(screen.getByLabelText("Symptoms"), description);
  await user.click(screen.getByRole("button", { name: "Submit symptoms" }));
}

test("the modal announces emergency instructions, focuses its title and offers a direct call", () => {
  const dismiss = jest.fn();
  render(<EmergencyAlert result={EMERGENCY} onDismiss={dismiss} />);
  const dialog = screen.getByRole("alertdialog", { name: "Emergency detected" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(dialog).toHaveAccessibleDescription(/Call 140.*Do not wait/);
  expect(within(dialog).getByRole("heading")).toHaveFocus();
  expect(within(dialog).getByRole("link", { name: "Call 140 (Lebanese Red Cross)" })).toHaveAttribute("href", "tel:140");
  fireEvent.click(dialog); // clicking the backdrop is not acknowledgement
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(dismiss).toHaveBeenCalledTimes(1);
});

test("unmount restores focus and scroll state, and an unknown country does not invent a phone number", () => {
  const trigger = document.createElement("button"); document.body.appendChild(trigger); trigger.focus();
  const overflow = document.body.style.overflow;
  const view = render(<EmergencyAlert result={{ ...EMERGENCY, emergency: { contactNumber: null } }} onDismiss={() => {}} />);
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Call your local emergency number now");
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe("hidden");
  view.unmount();
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).toBe(overflow);
  trigger.remove();
});

test("emergency popup appears before symptom saving or contact lookup finishes", async () => {
  const contacts = deferred(); getEmergencyContact.mockReturnValue(contacts.promise);
  const saving = deferred(); addSymptomRecord.mockReturnValue(saving.promise);
  const user = userEvent.setup(); render(<SymptomsPage />); await submit(user);
  expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  expect(getEmergencyContact).toHaveBeenCalledWith("self", expect.any(AbortSignal));
  expect(screen.queryByText("Symptoms recorded for Test User.")).not.toBeInTheDocument();
  await act(async () => { saving.resolve({ id: "record" }); contacts.resolve({ contact: null }); });
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
});

test("failed saving cannot suppress or dismiss an emergency alert", async () => {
  const saving = deferred(); addSymptomRecord.mockReturnValue(saving.promise);
  const user = userEvent.setup(); render(<SymptomsPage />); await submit(user);
  expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  const logging = jest.spyOn(console, "error").mockImplementation(() => {});
  await act(async () => saving.reject(new Error("storage unavailable")));
  logging.mockRestore();
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Close alert" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Urgency: Emergency" })).toBeInTheDocument();
});

test.each(["urgent", "soon", "routine"])("%s does not open an emergency popup", async level => {
  assessUrgency.mockResolvedValue({ ...SOON, level });
  const user = userEvent.setup(); render(<SymptomsPage />); await submit(user, "A cough today");
  await screen.findByText("Symptoms recorded for Test User.");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

test("closing the alert survives rerenders but a new emergency check alerts again", async () => {
  getEmergencyContact.mockResolvedValue({ contact: { name: "Rana", phone: "+96170123456" } });
  const user = userEvent.setup(); const view = render(<SymptomsPage />); await submit(user);
  await screen.findByRole("alertdialog");
  await screen.findByText("Symptoms recorded for Test User.");
  await user.click(screen.getByRole("button", { name: "Close alert" }));
  view.rerender(<SymptomsPage />);
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Urgency: Emergency" })).toBeInTheDocument();
  await submit(user);
  expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Share my location with Rana" })).toBeInTheDocument();
  expect(getEmergencyContact).toHaveBeenCalledTimes(2);
});

test("follow-up escalation alerts before the updated record is saved", async () => {
  assessUrgency.mockResolvedValue({ ...SOON, followUpQuestions: [{ id: "severity", text: "How bad?", options: [{ value: "severe", label: "Severe" }] }] });
  assessUrgencyWithAnswers.mockResolvedValue(EMERGENCY);
  const saving = deferred(); updateSymptomRecord.mockReturnValue(saving.promise);
  const user = userEvent.setup(); render(<SymptomsPage />); await submit(user, "Headache today");
  await user.click(await screen.findByLabelText("Severe"));
  await user.click(screen.getByRole("button", { name: "Update my urgency" }));
  expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  expect(updateSymptomRecord).toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Update my urgency" })).not.toBeInTheDocument();
  await act(async () => saving.resolve({ id: "record" }));
});

test("history does not trigger a new emergency popup", async () => {
  getSymptomsForProfile.mockResolvedValue([{ id: "old", description: "Old emergency", createdAt: new Date().toISOString(), urgencyResult: EMERGENCY }]);
  render(<SymptomsPage />);
  await screen.findByText(/Old emergency/);
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

test("a late assessment for a previous profile cannot open the popup", async () => {
  const assessment = deferred(); assessUrgency.mockReturnValue(assessment.promise);
  const user = userEvent.setup(); const view = render(<SymptomsPage />); await submit(user);
  useActiveProfile.mockReturnValue({ activeProfile: { id: "child", fullName: "Child" } });
  view.rerender(<SymptomsPage />);
  await act(async () => assessment.resolve(EMERGENCY));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(addSymptomRecord).not.toHaveBeenCalled();
});

test.each(emergencyRules.map(rule => [rule.id, rule.all ? rule.all.join(" and ") : rule.any[0]]))(
  "AI-off red flag %s displays 140 and the saved contact inside the alert", async (id, symptoms) => {
    const result = classifyUrgency(symptoms);
    expect(result.level).toBe("emergency");
    expect(result.matchedRuleIds).toContain(id);
    assessUrgency.mockResolvedValue({ ...result, ai: { used: false, reason: "emergency_rule" } });
    getEmergencyContact.mockResolvedValue({ contact: { name: "Rana", phone: "+96170123456" } });
    addSymptomRecord.mockReturnValue(new Promise(() => {})); // saving must not gate either action
    const user = userEvent.setup({ delay: null }); render(<SymptomsPage />);
    await submit(user, symptoms);
    const alert = await screen.findByRole("alertdialog");
    expect(within(alert).getByRole("link", { name: "Call 140 (Lebanese Red Cross)" })).toHaveAttribute("href", "tel:140");
    const contact = await within(alert).findByRole("region", { name: "Saved emergency contact" });
    expect(await within(contact).findByRole("link", { name: "Call Rana (emergency contact)" })).toHaveAttribute("href", "tel:+96170123456");
    expect(contact).toHaveTextContent("+96170123456");
  }
);

test("missing or failed contact lookup does not hide the emergency call action", async () => {
  getEmergencyContact.mockRejectedValue(new Error("contact service unavailable"));
  const user = userEvent.setup(); render(<SymptomsPage />); await submit(user);
  const alert = await screen.findByRole("alertdialog");
  expect(within(alert).getByRole("link", { name: "Call 140 (Lebanese Red Cross)" })).toBeInTheDocument();
  await within(alert).findByRole("button", { name: "Retry emergency contact" });
  getEmergencyContact.mockResolvedValue({ contact: null });
  await user.click(within(alert).getByRole("button", { name: "Retry emergency contact" }));
  expect(await within(alert).findByText(/No emergency contact with a valid phone number/)).toBeInTheDocument();
  expect(within(alert).getByRole("link", { name: "Call 140 (Lebanese Red Cross)" })).toBeInTheDocument();
});
