import { request } from "./api";

// The care circle (backend routes/careCircle.js): the people the user invited, and the circles the user is in.
export const CARE_CIRCLE_PROMISE = "People in your care circle are told when a symptom check needs attention. They never see your symptoms.";

export const getCareCircle = () => request("/care-circle");
export const inviteToCareCircle = (email) => request("/care-circle/invites", { method: "POST", body: JSON.stringify({ email }) });
export const cancelCareCircleInvite = (id) => request(`/care-circle/invites/${encodeURIComponent(id)}`, { method: "DELETE" });
export const removeCareCircleMember = (id) => request(`/care-circle/members/${encodeURIComponent(id)}`, { method: "DELETE" });
export const leaveCareCircle = (id) => request(`/care-circle/circles/${encodeURIComponent(id)}`, { method: "DELETE" });
// For the accept page: who sent the invitation and to which email. Works signed out.
export const lookupCareCircleInvite = (token) => request("/care-circle/invites/lookup", { method: "POST", body: JSON.stringify({ token }) }).then((data) => data.invite);
export const acceptCareCircleInvite = (token) => request("/care-circle/invites/accept", { method: "POST", body: JSON.stringify({ token }) });

// "22 October 2026".
export const longDate = (isoDate) => new Date(isoDate).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
