import { request } from "./api";

const query = (profileId) => `?profileId=${encodeURIComponent(profileId || "self")}`;

export const getProfileCoverage = (profileId) => request(`/profile-coverage${query(profileId)}`).then((data) => data.coverage);
export const updateProfileCoverage = (profileId, choices) => request(`/profile-coverage${query(profileId)}`, {
  method: "PATCH", body: JSON.stringify(choices),
}).then((data) => data.coverage);
export const uploadProfileDocument = (profileId, kind, file) => request(`/profile-coverage/documents/${encodeURIComponent(kind)}${query(profileId)}`, {
  method: "PUT", body: JSON.stringify({ file }),
}).then((data) => data.coverage);
export const deleteProfileDocument = (profileId, kind) => request(`/profile-coverage/documents/${encodeURIComponent(kind)}${query(profileId)}`, {
  method: "DELETE",
}).then((data) => data.coverage);
export const profileDocumentDownloadUrl = (profileId, kind) => `/api/profile-coverage/documents/${encodeURIComponent(kind)}/download${query(profileId)}`;
