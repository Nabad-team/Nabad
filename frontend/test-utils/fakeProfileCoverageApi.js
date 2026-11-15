const EMPTY = { hasInsurance: false, hasNssf: false, patientId: null, insuranceCard: null, nssfDocument: null };
let profiles = new Map();
const current = (profileId) => ({ ...EMPTY, ...(profiles.get(profileId) || {}) });
export const resetFakeProfileCoverage = () => { profiles = new Map(); };
export const getProfileCoverage = async (profileId) => current(profileId);
export const updateProfileCoverage = async (profileId, choices) => {
  const value = { ...current(profileId), ...choices }; profiles.set(profileId, value); return value;
};
export const uploadProfileDocument = async (profileId, kind, file) => {
  const fields = { patient_id: "patientId", insurance_card: "insuranceCard", nssf: "nssfDocument" };
  const value = { ...current(profileId), [fields[kind]]: { filename: file.filename, mimeType: file.mimeType, size: 4, uploadedAt: new Date().toISOString() } };
  if (kind === "insurance_card") value.hasInsurance = true;
  if (kind === "nssf") value.hasNssf = true;
  profiles.set(profileId, value); return value;
};
export const deleteProfileDocument = async (profileId, kind) => {
  const fields = { patient_id: "patientId", insurance_card: "insuranceCard", nssf: "nssfDocument" };
  const value = { ...current(profileId), [fields[kind]]: null }; profiles.set(profileId, value); return value;
};
export const profileDocumentDownloadUrl = (profileId, kind) => `/api/profile-coverage/documents/${kind}/download?profileId=${profileId}`;
