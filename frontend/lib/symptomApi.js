import { request } from "./api";

// Old Sprint 1 storage key.
// We remove it so health data is no longer left in the browser.
const OLD_STORAGE_KEY = "nabad-symptom-records";

function clearOldSymptomStorage() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(OLD_STORAGE_KEY);
  } catch (error) {
    console.error(
      "Could not clear old symptom records:",
      error
    );
  }
}

const path = (profileId, id) =>
  "/symptoms" +
  (id ? "/" + encodeURIComponent(id) : "") +
  "?profileId=" +
  encodeURIComponent(profileId);

// Save one symptom record.
export async function addSymptomRecord(
  profileId,
  profileName,
  symptoms,
  urgencyResult
) {
  clearOldSymptomStorage();

  const data = await request(
    path(profileId),
    {
      method: "POST",
      body: JSON.stringify({
        description: symptoms,
        urgencyResult,
      }),
    }
  );

  return {
    ...data.symptomRecord,
    profileName,
    symptoms:
      data.symptomRecord.description,
  };
}

// Get all symptom records for one profile.
export async function getSymptomsForProfile(
  profileId
) {
  clearOldSymptomStorage();

  const data = await request(
    path(profileId)
  );

  return data.symptomRecords.map(
    (record) => ({
      ...record,
      symptoms: record.description,
    })
  );
}

export async function updateSymptomRecord(profileId, recordId, answers, urgencyResult) {
  const data = await request(path(profileId, recordId), {
    method: "PATCH",
    body: JSON.stringify({ answers, urgencyResult }),
  });
  return { ...data.symptomRecord, symptoms: data.symptomRecord.description };
}

// Delete one symptom record.
export async function deleteSymptomRecord(
  profileId,
  recordId
) {
  clearOldSymptomStorage();

  await request(
    path(profileId, recordId),
    {
      method: "DELETE",
    }
  );
}
