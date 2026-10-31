import { request } from "./api";

export const getEmergencyCard = (profileId, signal) => request(
  `/emergency-card?profileId=${encodeURIComponent(profileId)}`, { signal, cache: "no-store" }
);
