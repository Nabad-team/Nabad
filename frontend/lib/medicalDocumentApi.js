const API_BASE = "/api/medical-documents";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export const getMedicalDocuments = (profileId) => request(`/?profileId=${encodeURIComponent(profileId || "self")}`);
export const uploadMedicalDocument = (profileId, file, metadata = {}) => request(`/?profileId=${encodeURIComponent(profileId || "self")}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file, ...metadata }),
});
export const updateMedicalDocumentMetadata = (profileId, id, metadata) => request(`/${encodeURIComponent(id)}?profileId=${encodeURIComponent(profileId || "self")}`, {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metadata),
}).then((data) => data.document);
export const medicalDocumentDownloadUrl = (profileId, id) => `${API_BASE}/${encodeURIComponent(id)}/download?profileId=${encodeURIComponent(profileId || "self")}`;

