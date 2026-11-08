// Builds fake S3 ListObjectVersions results for the tests.
const { backupFiles } = require("../lib/naming");

function stampFor(day, hour = 1) {
  const d = new Date(Date.UTC(2026, 10, day, hour, 0, 7));
  return d.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[-:]/g, "");
}

function backupVersions(folder, stamp, { kinds = ["archive", "counts", "manifest"], size = 1000 } = {}) {
  const files = backupFiles(stamp);
  return kinds.map((kind) => ({ Key: `${folder}/${files[kind]}`, VersionId: `v-${stamp}-${kind}`, IsLatest: true, Size: kind === "archive" ? size : 200 }));
}

function listing(folder, stamps, extra = {}) {
  return { Versions: [...stamps.flatMap((s) => backupVersions(folder, s)), ...(extra.Versions || [])], DeleteMarkers: extra.DeleteMarkers || [] };
}

module.exports = { stampFor, backupVersions, listing };
