import { request } from "./api";

const query = (profileId, range) => `?profileId=${encodeURIComponent(profileId)}${range ? `&range=${range}` : ""}`;
export const listVitals = (profileId, range = "30") => request(`/vitals${query(profileId, range)}`);
export const addVital = (profileId, reading) => request(`/vitals${query(profileId)}`, { method: "POST", body: JSON.stringify(reading) }).then(data => data.reading);
export const deleteVital = (profileId, id) => request(`/vitals/${encodeURIComponent(id)}${query(profileId)}`, { method: "DELETE" });
