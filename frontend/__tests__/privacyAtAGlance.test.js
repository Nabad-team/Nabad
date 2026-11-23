// SCRUM-343: "Privacy at a glance" in My profile.
import { render, screen, within } from "@testing-library/react";
import PrivacyAtAGlance, { AI_USES } from "../components/PrivacyAtAGlance";

test("says what Nabad stores, what goes to the AI and what never does, and how to export or delete", () => {
  render(<PrivacyAtAGlance />);
  const card = screen.getByRole("region", { name: "Privacy at a glance" });
  expect(within(card).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
    "What Nabad stores", "What goes to the AI", "What never goes to the AI", "Export or delete",
  ]);
  expect(within(card).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
});

test("lists every feature that sends something to the AI, and only those", () => {
  render(<PrivacyAtAGlance />);
  const ai = screen.getByRole("region", { name: "What goes to the AI" });
  expect(within(ai).getAllByRole("listitem").map((item) => item.querySelector("strong").textContent)).toEqual(
    ["Symptom check:", "Health assistant:", "Prescription photo:", "Ask about my history:"],
  );
  expect(AI_USES).toHaveLength(4);
  expect(ai).toHaveTextContent("Google's Gemini AI service");
  expect(ai).toHaveTextContent("only if you tick “Let AI write the answer”");
});

test("never-sent list names identity, contacts, location and files", () => {
  render(<PrivacyAtAGlance />);
  const never = screen.getByRole("region", { name: "What never goes to the AI" });
  for (const words of ["name, email, phone number and date of birth", "emergency contact", "care circle", "location", "My documents", "vitals", "questions for the doctor"]) {
    expect(never).toHaveTextContent(words);
  }
});

test("links to Download my data and Delete my account on the same page", () => {
  render(<PrivacyAtAGlance />);
  const control = screen.getByRole("region", { name: "Export or delete" });
  expect(within(control).getByRole("link", { name: "Download my data" })).toHaveAttribute("href", "#data-export-heading");
  expect(within(control).getByRole("link", { name: "Delete my account" })).toHaveAttribute("href", "#danger-heading");
});
