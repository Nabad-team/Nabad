// In-memory stand-in for lib/healthProfileApi.js, used only by tests. Like the backend, everything is kept
// per profile, a basic (sex, height...) or a listed condition can be recorded only once, suggestions wait until
// confirmed or dismissed, and the summary uses confirmed facts only. The summary here is a simple stand-in:
// the real one is built and tested in the backend (healthProfile.js).
// Use it with:
//   jest.mock("../lib/healthProfileApi", () => require("../test-utils/fakeHealthProfileApi"));
// and call resetFakeHealth() in beforeEach.

const SINGLE = ["sex", "height", "weight", "bloodType", "pregnancy", "smoking"];
const NOW = "2026-10-12T09:00:00.000Z";
let store;
let nextId;
let failLoading;
export const calls = [];
export function resetFakeHealth() {
  store = {};
  nextId = 1;
  failLoading = false;
  calls.length = 0;
}
resetFakeHealth();

function profile(profileId) {
  if (!store[profileId]) store[profileId] = { dateOfBirth: "", age: null, facts: [], medications: [] };
  return store[profileId];
}
const fail = (message, status) => { throw Object.assign(new Error(message), { status }); };

// Test helpers: put data straight into the fake.
export function seedAge(profileId, dateOfBirth, years, text = `${years} years`) { Object.assign(profile(profileId), { dateOfBirth, age: { years, text } }); }
export function seedFact(profileId, category, value, fields = {}) {
  const fact = { id: `fact-${nextId++}`, category, value, source: "user", status: "confirmed", recordedAt: NOW, updatedAt: NOW, ...fields };
  profile(profileId).facts.push(fact);
  return fact;
}
export const seedSuggestion = (profileId, category, value) => seedFact(profileId, category, value, { source: "lab_report", status: "suggested" });
export function seedMedication(profileId, medication) { profile(profileId).medications.push({ id: `med-${nextId++}`, dose: "", unit: "", form: "tablet", frequency: "", ...medication }); }
export const fakeFacts = (profileId) => profile(profileId).facts;
export function failFakeHealthLoading() { failLoading = true; }

const confirmed = (profileId) => profile(profileId).facts.filter((fact) => fact.status === "confirmed");
const slot = (category, value) => (SINGLE.includes(category) ? category : category === "condition" && value.code !== "other" ? `condition:${value.code}` : null);
const taken = (profileId, category, value, exceptId) => {
  const wanted = slot(category, value);
  return wanted && confirmed(profileId).some((fact) => fact.id !== exceptId && slot(fact.category, fact.value) === wanted);
};
function summary(profileId) {
  const data = profile(profileId);
  const facts = confirmed(profileId);
  const value = (category) => facts.find((fact) => fact.category === category)?.value;
  const conditions = facts.filter((fact) => fact.category === "condition").map((fact) => fact.value.text || fact.value.code.replace(/_/g, " "));
  const allergies = facts.filter((fact) => fact.category === "allergy").map((fact) => `${fact.value.name} (${fact.value.type})`);
  return [
    `Age: ${data.age ? data.age.text : "not recorded"}`,
    `Sex assigned at birth: ${value("sex") || "not recorded"}`,
    `Long-term conditions: ${conditions.join("; ") || "none recorded"}`,
    `Allergies: ${allergies.join("; ") || "none recorded"}`,
    `Current medications: ${data.medications.map((m) => m.name).join("; ") || "none recorded"}`,
  ].join("\n");
}
function findFact(profileId, id, status) {
  const fact = profile(profileId).facts.find((item) => item.id === id && item.status === status);
  if (!fact) fail(status === "suggested" ? "Suggestion not found." : "Health information not found.", 404);
  return fact;
}

export async function getHealthProfile(profileId) {
  calls.push(["getHealthProfile", profileId]);
  if (failLoading) fail("Request failed.", 500);
  const data = profile(profileId);
  return {
    dateOfBirth: data.dateOfBirth, age: data.age,
    facts: confirmed(profileId).map((fact) => ({ ...fact, profileId })),
    suggestions: data.facts.filter((fact) => fact.status === "suggested").map((fact) => ({ ...fact, profileId })),
    medications: data.medications.slice(), summary: summary(profileId),
  };
}
export async function addHealthFact(profileId, category, value) {
  calls.push(["addHealthFact", profileId, category, value]);
  if (taken(profileId, category, value)) fail("This is already recorded. Change or remove it instead.", 409);
  return seedFact(profileId, category, value);
}
export async function updateHealthFact(profileId, id, value) {
  calls.push(["updateHealthFact", profileId, id, value]);
  const fact = findFact(profileId, id, "confirmed");
  if (taken(profileId, fact.category, value, id)) fail("This is already recorded. Change or remove it instead.", 409);
  return Object.assign(fact, { value, updatedAt: NOW });
}
export async function removeHealthFact(profileId, id) {
  calls.push(["removeHealthFact", profileId, id]);
  findFact(profileId, id, "confirmed");
  profile(profileId).facts = profile(profileId).facts.filter((fact) => fact.id !== id);
}
export async function confirmSuggestion(profileId, id) {
  calls.push(["confirmSuggestion", profileId, id]);
  const fact = findFact(profileId, id, "suggested");
  if (SINGLE.includes(fact.category)) profile(profileId).facts = profile(profileId).facts.filter((item) => !(item.status === "confirmed" && item.category === fact.category));
  return Object.assign(fact, { status: "confirmed" });
}
export async function dismissSuggestion(profileId, id) {
  calls.push(["dismissSuggestion", profileId, id]);
  findFact(profileId, id, "suggested");
  profile(profileId).facts = profile(profileId).facts.filter((fact) => fact.id !== id);
}
