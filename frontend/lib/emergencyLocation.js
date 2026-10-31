// One-time device position only. No symptoms, identifiers or contact details in the map URL.
export const LOCATION_LIFETIME_MS = 120000;

export function locationSnapshot(position, now = Date.now()) {
  const { latitude, longitude, accuracy } = position?.coords || {};
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("Invalid location");
  const timestamp = Number.isFinite(position.timestamp) ? position.timestamp : now;
  if (timestamp < now - LOCATION_LIFETIME_MS || timestamp > now + 60000) throw new Error("Stale location");
  return {
    url: `https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(6)},${longitude.toFixed(6)}`,
    capturedAt: new Date(timestamp).toISOString(),
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? Math.ceil(accuracy) : null,
  };
}

export function contactNumber(phone) {
  if (typeof phone !== "string") return null;
  const number = phone.replace(/[\s().-]/g, "");
  return /^(?:\+[1-9]\d{7,14}|\d{7,8})$/.test(number) ? number : null;
}

export function locationMessage(fix) {
  return `I may need emergency help. This device's location, captured ${fix.capturedAt}: ${fix.url}\nThis is a one-time location, not live tracking.`;
}

// Messaging apps differ in how they accept a prefilled body. Opening a draft is
// not delivery: the user must review and send it in their own messaging app.
export function locationSmsUrl(phone, fix, appleMobile = false) {
  const number = contactNumber(phone);
  if (!number) return null;
  return `sms:${number}${appleMobile ? "&" : "?"}body=${encodeURIComponent(locationMessage(fix))}`;
}
