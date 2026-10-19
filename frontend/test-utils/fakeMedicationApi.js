const medicationData = {};
export const calls = [];

export function resetFakeMedications() {
  Object.keys(medicationData).forEach((key) => delete medicationData[key]);
  calls.length = 0;
}
export function seedMedication(profileId, medication) {
  medicationData[profileId] ||= [];
  medicationData[profileId].push({ id: `med-${medicationData[profileId].length + 1}`, name: "Medicine", dose: "1", unit: "tablet", frequency: "once a day", taken: false, ...medication });
}
export async function getMedicationAdherence(profileId, date) {
  calls.push(["getMedicationAdherence", profileId, date]);
  return (medicationData[profileId] || []).map((item) => ({ ...item }));
}
export async function setMedicationTaken(profileId, id, date, taken) {
  calls.push(["setMedicationTaken", profileId, id, date, taken]);
  const medication = medicationData[profileId]?.find((item) => item.id === id);
  if (!medication) throw new Error("Medication not found");
  medication.taken = taken;
}
