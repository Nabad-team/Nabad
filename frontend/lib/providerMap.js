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

// At broad zoom levels group nearby pins in projected screen space. At close
// zoom only exact coordinates share a marker, preserving individual locations.
export function clusterMapProviders(groups, project, zoom) {
  if (zoom >= 14) return groups;
  const clusters = new Map();
  for (const group of groups) {
    const { latitude, longitude } = group[0];
    const { x, y } = project([latitude, longitude], zoom);
    const key = `${Math.floor(x / 48)},${Math.floor(y / 48)}`;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(...group);
  }
  return [...clusters.values()];
}
