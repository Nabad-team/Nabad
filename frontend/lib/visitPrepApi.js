async function request(profileId, options = {}) {
  const response = await fetch(`/api/visit-prep?profileId=${encodeURIComponent(profileId)}`, { credentials: "include", ...options });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not save the visit sheet. Please try again.");
  return result;
}
export const getVisitPrep = (profileId) => request(profileId);
export const saveVisitPrep = (profileId, sheet) => request(profileId, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sheet) });
