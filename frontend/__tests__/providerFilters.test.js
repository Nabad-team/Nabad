import { readProviderFilters, providerUrl, triageProviderUrl } from "../lib/providerFilters";
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
test("every specialty label has a seeded match and every seeded specialty has a label", () => {
  const providers = require("../../backend/data/providers");
  const labels = require("../locales/en/providers.json").specialties;
  const seeded = new Set(providers.flatMap(provider => provider.specialties));
  for (const slug of Object.keys(labels)) expect(seeded.has(slug)).toBe(true);
  for (const slug of seeded) expect(labels[slug]).toEqual(expect.any(String));
});
