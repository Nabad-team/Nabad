import { request } from "./api";
export const searchNabad = (profileId, q, signal) => request(`/search?profileId=${encodeURIComponent(profileId)}`, {
  method: "POST", body: JSON.stringify({ q }), signal,
});
