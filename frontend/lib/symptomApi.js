const STORAGE_KEY = "nabad-symptom-records";

function loadSymptoms() {
  if (typeof window === "undefined") {
    return [];
  }

  const storedSymptoms = localStorage.getItem(STORAGE_KEY);

  if (!storedSymptoms) {
    return [];
  }

  try {
    return JSON.parse(storedSymptoms);
  } catch (error) {
    console.error("Could not read symptom records:", error);
    return [];
  }
}

function saveSymptoms(records) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export async function addSymptomRecord(profileId, profileName, symptoms) {
  const records = loadSymptoms();

  const newRecord = {
    id: Date.now().toString(),
    profileId,
    profileName,
    symptoms,
    createdAt: new Date().toISOString(),
  };

  const updatedRecords = [...records, newRecord];

  saveSymptoms(updatedRecords);

  return newRecord;
}

export async function getSymptomsForProfile(profileId) {
  const records = loadSymptoms();

  return records.filter((record) => record.profileId === profileId);
}