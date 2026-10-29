import { request } from "./api";
export function getProviders(filters = {}, signal) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value !== null && value !== undefined && value !== false) query.set(key, String(value));
  }
  return request(`/providers?${query}`, { signal });
}
export const getProvider = (id, signal) => request(`/providers/${encodeURIComponent(id)}`, { signal }).then(data => data.provider);
export const getMyProviderFeedback = (id, signal) => request(`/providers/${encodeURIComponent(id)}/feedback/me`, { signal }).then(data => data.feedback);
export const saveProviderFeedback = (id, body) => request(`/providers/${encodeURIComponent(id)}/feedback`, { method: "PUT", body: JSON.stringify(body) });
export const removeProviderFeedback = id => request(`/providers/${encodeURIComponent(id)}/feedback`, { method: "DELETE" });
export const getMyProviderCorrections = (id, signal) => request(`/providers/${encodeURIComponent(id)}/corrections/me`, { signal }).then(data => data.reports);
export const reportProviderCorrection = (id, body) => request(`/providers/${encodeURIComponent(id)}/corrections`, { method: "PUT", body: JSON.stringify(body) });
export const removeProviderCorrection = (id, field) => request(`/providers/${encodeURIComponent(id)}/corrections/${encodeURIComponent(field)}`, { method: "DELETE" });
export const getProviderFavorites = () => request("/providers/favorites").then(data => data.favorites);
export const setProviderFavorite = (id, favorite) => request(`/providers/${encodeURIComponent(id)}/favorite`, { method: favorite ? "PUT" : "DELETE" });
