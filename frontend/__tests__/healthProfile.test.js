// Unit tests for the words and small rules of "My health" (lib/healthProfile.js).
import { factText, shortDate, sourceText, basicsFilled, knowsYouText, pregnancyRelevant } from "../lib/healthProfile";

const fact = (category, value, fields = {}) => ({ category, value, source: "user", status: "confirmed", recordedAt: "2026-10-12T09:00:00Z", updatedAt: "2026-10-12T09:00:00Z", ...fields });
const NOW = new Date("2026-10-20T12:00:00");

describe("factText", () => {
  test("reads each kind of value in plain words", () => {
    expect(factText(fact("sex", "female"))).toBe("Female");
    expect(factText(fact("height", 172))).toBe("172 cm");
    expect(factText(fact("weight", 72.5))).toBe("72.5 kg");
    expect(factText(fact("bloodType", "AB-"))).toBe("AB-");
    expect(factText(fact("bloodType", "unknown"))).toBe("I don't know");
    expect(factText(fact("pregnancy", "not_pregnant"))).toBe("Not pregnant");
    expect(factText(fact("smoking", "former"))).toBe("Used to smoke");
    expect(factText(fact("condition", { code: "high_blood_pressure" }))).toBe("High blood pressure");
    expect(factText(fact("condition", { code: "other", text: "Migraine" }))).toBe("Migraine");
    expect(factText(fact("allergy", { type: "food", name: "Peanuts", reaction: "" }))).toBe("Peanuts");
  });
});

describe("sourceText", () => {
  test("says who added it and when, with the year only when it isn't this year", () => {
    expect(sourceText(fact("sex", "male"), NOW)).toBe("You added this, 12 Oct");
    expect(sourceText(fact("sex", "male", { recordedAt: "2025-03-05T09:00:00Z", updatedAt: "2025-03-05T09:00:00Z" }), NOW)).toBe("You added this, 5 Mar 2025");
    expect(shortDate("not a date", NOW)).toBe("");
  });

  test("adds when it was last changed, if on a later day", () => {
    expect(sourceText(fact("sex", "male", { updatedAt: "2026-10-14T09:00:00Z" }), NOW)).toBe("You added this, 12 Oct · updated 14 Oct");
    expect(sourceText(fact("sex", "male", { updatedAt: "2026-10-12T10:00:00Z" }), NOW)).toBe("You added this, 12 Oct");
  });

  test("names other sources, and suggestions as suggested", () => {
    expect(sourceText(fact("bloodType", "O+", { source: "lab_report" }), NOW)).toBe("From a lab report, 12 Oct");
    expect(sourceText(fact("bloodType", "O+", { source: "lab_report", status: "suggested" }), NOW)).toBe("Suggested from a lab report, 12 Oct");
    expect(sourceText(fact("condition", { code: "asthma" }, { source: "symptom_check" }), NOW)).toBe("From a symptom check, 12 Oct");
  });
});

describe("Nabad knows you better", () => {
  test("counts the five basics: date of birth, sex, height, weight and blood type (\"I don't know\" counts)", () => {
    expect(basicsFilled({ dateOfBirth: "", facts: [] })).toBe(0);
    expect(basicsFilled({ dateOfBirth: "1990-01-01", facts: [fact("bloodType", "unknown"), fact("smoking", "never"), fact("condition", { code: "asthma" })] })).toBe(2);
    const all = { dateOfBirth: "1990-01-01", facts: ["sex", "height", "weight", "bloodType"].map((category) => fact(category, "x")) };
    expect(basicsFilled(all)).toBe(5);
  });

  test("is gentle, and names the family member", () => {
    expect(knowsYouText(0)).toBe("Nabad knows you better: 0 of 5 basics filled in.");
    expect(knowsYouText(3, "Sami")).toBe("Nabad knows Sami better: 3 of 5 basics filled in.");
    expect(knowsYouText(5)).toBe("All 5 basics are filled in. Thank you: Nabad knows you better.");
  });
});

describe("pregnancyRelevant", () => {
  const profile = (sex, years) => ({ age: years === undefined ? null : { years }, facts: sex ? [fact("sex", sex)] : [] });
  test("only for female, aged 10 to 55 or with no age yet", () => {
    expect(pregnancyRelevant(profile("female", 30))).toBe(true);
    expect(pregnancyRelevant(profile("female"))).toBe(true);
    expect(pregnancyRelevant(profile("female", 10))).toBe(true);
    expect(pregnancyRelevant(profile("female", 55))).toBe(true);
    expect(pregnancyRelevant(profile("female", 9))).toBe(false);
    expect(pregnancyRelevant(profile("female", 56))).toBe(false);
    expect(pregnancyRelevant(profile("male", 30))).toBe(false);
    expect(pregnancyRelevant(profile(null, 30))).toBe(false);
  });
});
