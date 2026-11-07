// Backup file names. Every backup is three objects that share one UTC timestamp:
//   nabad-20261108T010312Z.archive.gz.age   the encrypted mongodump archive
//   nabad-20261108T010312Z.manifest.json    plain: timestamp, size, SHA-256, tool versions
//   nabad-20261108T010312Z.counts.json.age  encrypted per-collection document counts
// Retention and verification read the timestamp from the name, never from upload times.

const PREFIX = "nabad-";
const KINDS = {
  archive: ".archive.gz.age",
  manifest: ".manifest.json",
  counts: ".counts.json.age",
};
const NAME_PATTERN = /^nabad-(\d{8}T\d{6}Z)(\.archive\.gz\.age|\.manifest\.json|\.counts\.json\.age)$/;

function formatStamp(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError("formatStamp needs a valid Date");
  }
  return date.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[-:]/g, "");
}

function stampToDate(stamp) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(stamp);
  if (!m) return null;
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  // Rejects impossible dates such as 20261340T..., which Date.UTC would roll over.
  return formatStamp(date) === stamp ? date : null;
}

function backupFiles(stamp) {
  if (!stampToDate(stamp)) throw new Error("Invalid backup timestamp");
  return {
    archive: `${PREFIX}${stamp}${KINDS.archive}`,
    manifest: `${PREFIX}${stamp}${KINDS.manifest}`,
    counts: `${PREFIX}${stamp}${KINDS.counts}`,
  };
}

// "daily/nabad-20261108T010312Z.manifest.json" -> { folder, name, stamp, kind, date }.
// Anything that isn't one of our files returns null, so retention never touches it.
function parseKey(key) {
  if (typeof key !== "string") return null;
  const slash = key.lastIndexOf("/");
  const folder = slash === -1 ? "" : key.slice(0, slash);
  const name = key.slice(slash + 1);
  const m = NAME_PATTERN.exec(name);
  if (!m) return null;
  const date = stampToDate(m[1]);
  if (!date) return null;
  const kind = Object.keys(KINDS).find((k) => KINDS[k] === m[2]);
  return { folder, name, stamp: m[1], kind, date };
}

function isSunday(date) {
  return date.getUTCDay() === 0;
}

module.exports = { KINDS, formatStamp, stampToDate, backupFiles, parseKey, isSunday };
