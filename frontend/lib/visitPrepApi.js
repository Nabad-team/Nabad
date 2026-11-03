async function request(profileId, options = {}) {
  const response = await fetch(`/api/visit-prep?profileId=${encodeURIComponent(profileId)}`, { credentials: "include", ...options });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not save the visit sheet. Please try again.");
  return result;
}
export const getVisitPrep = (profileId) => request(profileId);
export const saveVisitPrep = (profileId, sheet) => request(profileId, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sheet) });

async function shareRequest(path, options = {}) {
  const response = await fetch(`/api/visit-prep-shares${path}`, { credentials: "include", ...options });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not manage the shared link. Please try again.");
  return result;
}

export const getVisitPrepShares = (profileId) => shareRequest(`?profileId=${encodeURIComponent(profileId)}`);
export const createVisitPrepShare = (profileId, snapshot) => shareRequest(`?profileId=${encodeURIComponent(profileId)}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot),
});
export const revokeVisitPrepShare = (profileId, shareId) => shareRequest(`/${encodeURIComponent(shareId)}?profileId=${encodeURIComponent(profileId)}`, { method: "DELETE" });

export async function getSharedVisitPrep(token) {
  const response = await fetch(`/api/visit-prep-shares/public/${encodeURIComponent(token)}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "This shared visit sheet is not available.");
  return result.sheet;
}

export async function confirmSharedVisitPrep(token, clinicianName) {
  const response = await fetch(`/api/visit-prep-shares/public/${encodeURIComponent(token)}/confirm`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clinicianName, accurate: true }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not confirm this visit sheet.");
  return result;
}

export const sharedDocumentDownloadUrl = (token, documentId) => `/api/visit-prep-shares/public/${encodeURIComponent(token)}/documents/${encodeURIComponent(documentId)}`;
