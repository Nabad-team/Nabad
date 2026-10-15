import { request } from "./api";
export function getProviders(filters = {}, signal) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value !== null && value !== undefined && value !== false) query.set(key, String(value));
  }
  return request(`/providers?${query}`, { signal });
}
export const getProviderFavorites = () => request("/providers/favorites").then(data => data.favorites);
export const setProviderFavorite = (id, favorite) => request(`/providers/${encodeURIComponent(id)}/favorite`, { method: favorite ? "PUT" : "DELETE" });
