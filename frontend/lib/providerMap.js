// One marker per coordinate, so clinics sharing a hospital campus remain selectable.
export function groupMapProviders(providers) {
  const groups = new Map();
  for (const provider of providers) {
    if (!Number.isFinite(provider.latitude) || !Number.isFinite(provider.longitude) || Math.abs(provider.latitude) > 90 || Math.abs(provider.longitude) > 180) continue;
    const key = `${provider.latitude},${provider.longitude}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(provider);
  }
  return [...groups.values()];
}
