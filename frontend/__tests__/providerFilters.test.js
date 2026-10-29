import { readProviderFilters, providerUrl, triageProviderUrl, triageProviderLabel, TRIAGE_CARE_TYPE_IDS } from "../lib/providerFilters";
test("public URL contract round-trips canonical filters without location or symptoms", () => {
  const url = providerUrl({ specialty: "cardiology", service: "cath-lab", emergency24h: true, lat: 33.9, lng: 35.5, radiusKm: 10, symptoms: "private" });
  expect(url).toBe("/providers?specialty=cardiology&service=cath-lab&emergency24h=true");
  expect(readProviderFilters({ specialty: ["a", "b"], page: "-1" })).toMatchObject({ specialty: "", page: 1 });
});
test("triage uses urgency without inventing a specialty from care type or rule IDs", () => {
  expect(triageProviderUrl({ level: "emergency", symptoms: "chest pain" })).toBe("/providers?emergency24h=true");
  expect(triageProviderUrl({ level: "soon", careType: "General practitioner", matchedRuleIds: ["rash"] })).toBe("/providers");
  expect(triageProviderUrl({ level: "emergency", careType: "قسم الطوارئ", matchedRuleIds: ["stroke", "rash"] })).toBe("/providers?emergency24h=true");
  expect(triageProviderUrl({ routing: { providerFilters: { specialty: { $ne: "x" } } } })).toBe("/providers");
});
// SCRUM-278: triage returns careTypeId, a fixed id, and only that id can narrow the directory.
test("a care-type id opens the directory filtered by the recommended specialty", () => {
  expect(triageProviderUrl({ level: "soon", careTypeId: "dermatology" })).toBe("/providers?specialty=dermatology");
  expect(triageProviderUrl({ level: "routine", careTypeId: "ent" })).toBe("/providers?specialty=ent");
  expect(triageProviderUrl({ level: "soon", careTypeId: "general-practitioner" })).toBe("/providers?specialty=family-medicine");
  expect(triageProviderUrl({ level: "routine", careTypeId: "self-care" })).toBe("/providers?specialty=family-medicine");
});
test("urgent results show 24/7 emergency facilities, with the specialty when there is one", () => {
  expect(triageProviderUrl({ level: "urgent", careTypeId: "urgent-care" })).toBe("/providers?emergency24h=true");
  expect(triageProviderUrl({ level: "urgent", careTypeId: "orthopedics" })).toBe("/providers?specialty=orthopedics&emergency24h=true");
});
test("an emergency is never narrowed to a specialty, whatever id it carries", () => {
  expect(triageProviderUrl({ level: "emergency", careTypeId: "cardiology" })).toBe("/providers?emergency24h=true");
  expect(triageProviderUrl({ level: "emergency", careTypeId: "emergency-department" })).toBe("/providers?emergency24h=true");
});
test("unknown, malformed or inherited ids are ignored", () => {
  for (const careTypeId of ["oncology-xyz", "__proto__", "constructor", "toString", "", 42, null, { specialty: "x" }, ["ent"]]) {
    expect(triageProviderUrl({ level: "soon", careTypeId })).toBe("/providers");
  }
});
test("the button says what the directory will show", () => {
  expect(triageProviderLabel({ level: "emergency", careTypeId: "emergency-department" })).toBe("Browse published 24/7 ER facilities in Lebanon");
  expect(triageProviderLabel({ level: "soon", careTypeId: "dermatology" })).toBe("Find dermatology providers in Lebanon");
  expect(triageProviderLabel({ level: "soon", careTypeId: "ent" })).toBe("Find ear, nose and throat providers in Lebanon");
  expect(triageProviderLabel({ level: "urgent", careTypeId: "orthopedics" })).toBe("Browse 24/7 ER facilities with orthopedics in Lebanon");
  expect(triageProviderLabel({ level: "urgent", careTypeId: "urgent-care" })).toBe("Browse published 24/7 ER facilities in Lebanon");
  expect(triageProviderLabel({ level: "soon" })).toBe("Browse hospitals and clinics in Lebanon");
});
test("the frontend knows exactly the care-type ids the backend can return", () => {
  const { CARE_TYPES } = require("../../backend/src/triage/careTypes");
  expect([...TRIAGE_CARE_TYPE_IDS].sort()).toEqual(Object.keys(CARE_TYPES).sort());
});
test("every specialty a care type opens exists in the directory and has a label", () => {
  const providers = require("../../backend/data/providers");
  const labels = require("../locales/en/providers.json").specialties;
  const seeded = new Set(providers.flatMap(provider => provider.specialties));
  for (const careTypeId of TRIAGE_CARE_TYPE_IDS) {
    const specialty = new URLSearchParams(triageProviderUrl({ level: "soon", careTypeId }).split("?")[1]).get("specialty")
      || new URLSearchParams(triageProviderUrl({ level: "urgent", careTypeId }).split("?")[1]).get("specialty");
    if (!specialty) continue; // emergency-department and urgent-care open 24/7 ERs instead
    expect(seeded.has(specialty)).toBe(true);
    expect(labels[specialty]).toEqual(expect.any(String));
  }
});
test("every specialty label has a seeded match and every seeded specialty has a label", () => {
  const providers = require("../../backend/data/providers");
  const labels = require("../locales/en/providers.json").specialties;
  const seeded = new Set(providers.flatMap(provider => provider.specialties));
  for (const slug of Object.keys(labels)) expect(seeded.has(slug)).toBe(true);
  for (const slug of seeded) expect(labels[slug]).toEqual(expect.any(String));
});

test("insurance URL filters reject objects and survive a round trip without GPS", () => {
  expect(providerUrl({ insurance: "NSSF", lat: 33.9, lng: 35.5 })).toBe("/providers?insurance=nssf");
  expect(readProviderFilters({ insurance: { $ne: "" } }).insurance).toBe("");
});
test("every sourced service and insurance has an English label and source evidence", () => {
  const providers = require("../../backend/data/providers");
  const labels = require("../locales/en/providers.json");
  for (const p of providers) {
    for (const id of p.services) expect(labels.services[id]).toEqual(expect.any(String));
    for (const id of p.insurances || []) expect(labels.insurances[id]).toEqual(expect.any(String));
    if (p.insurances?.length) {
      expect(p.insuranceSources.length).toBeGreaterThan(0);
      expect(Number.isFinite(Date.parse(p.insuranceVerifiedAt))).toBe(true);
    }
    if (p.servicesReviewedAt) expect(p.serviceSources.length).toBeGreaterThan(0);
  }
});
