// Which objects to delete from a backup folder. Works on an S3 ListObjectVersions result, because
// Backblaze B2 keeps old versions: a plain delete only hides a file. To really remove a backup
// (and the deleted accounts in it) every version of its three files must be deleted by version ID.

const { KINDS, parseKey } = require("./naming");

const KIND_COUNT = Object.keys(KINDS).length;

function entriesOf(listing) {
  const versions = (listing && listing.Versions) || [];
  const markers = (listing && listing.DeleteMarkers) || [];
  return [
    ...versions.map((v) => ({ key: v.Key, versionId: v.VersionId, isLatest: Boolean(v.IsLatest), size: Number(v.Size), deleteMarker: false })),
    ...markers.map((m) => ({ key: m.Key, versionId: m.VersionId, isLatest: Boolean(m.IsLatest), size: 0, deleteMarker: true })),
  ];
}

// Groups the visible (latest, not deleted) files by backup timestamp, newest first.
function groupBackups(listing) {
  const groups = new Map();
  for (const entry of entriesOf(listing)) {
    if (!entry.isLatest || entry.deleteMarker) continue;
    const parsed = parseKey(entry.key);
    if (!parsed) continue;
    if (!groups.has(parsed.stamp)) groups.set(parsed.stamp, { stamp: parsed.stamp, date: parsed.date, files: {} });
    groups.get(parsed.stamp).files[parsed.kind] = { key: entry.key, size: entry.size };
  }
  return [...groups.values()]
    .map((g) => ({ ...g, complete: Object.keys(g.files).length === KIND_COUNT }))
    .sort((a, b) => b.date - a.date);
}

// Returns the { key, versionId } pairs to delete so that only the newest `keep` complete backups
// remain. A backup still being written (`protect`) is always kept. Files that don't follow our
// naming are never deleted. If no complete backup would remain, nothing is deleted.
function selectForDeletion(listing, { keep, protect } = {}) {
  if (!Number.isInteger(keep) || keep < 1) throw new Error("keep must be a positive integer");
  const kept = new Set(
    groupBackups(listing)
      .filter((g) => g.complete)
      .slice(0, keep)
      .map((g) => g.stamp)
  );
  if (kept.size === 0) return [];
  if (protect) kept.add(protect);

  return entriesOf(listing)
    .filter((entry) => {
      const parsed = parseKey(entry.key);
      return parsed && !kept.has(parsed.stamp);
    })
    .map(({ key, versionId }) => ({ key, versionId }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

module.exports = { groupBackups, selectForDeletion, entriesOf };
