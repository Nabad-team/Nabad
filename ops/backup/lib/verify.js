// The weekly verification: checks the stored backups using only the plain manifests and the
// encrypted files' checksums. It never decrypts anything.

const { groupBackups, entriesOf } = require("./retention");
const { validateManifest } = require("./manifest");
const { checkFreshness, checkSizeRatio } = require("./checks");

const DEFAULT_LIMITS = { dailyKeep: 7, weeklyKeep: 4, maxAgeHours: 26, minSizeRatio: 0.5 };

// The newest and previous complete daily backups, which the workflow then downloads.
function planVerification(dailyListing) {
  const complete = groupBackups(dailyListing).filter((g) => g.complete);
  return { newest: complete[0] || null, previous: complete[1] || null };
}

function checkFolder(listing, keep, label) {
  const problems = [];
  const groups = groupBackups(listing);
  if (groups.some((g) => !g.complete)) problems.push(`${label} has an incomplete backup`);
  if (groups.length > keep) problems.push(`${label} holds more than ${keep} backups`);
  if (entriesOf(listing).some((e) => e.deleteMarker || !e.isLatest)) problems.push(`${label} still has old versions of deleted files`);
  return problems;
}

function verifyBackups({ daily, weekly, newestManifest, previousManifest, downloaded, now, limits = {} }) {
  const { dailyKeep, weeklyKeep, maxAgeHours, minSizeRatio } = { ...DEFAULT_LIMITS, ...limits };
  const problems = [...checkFolder(daily, dailyKeep, "daily/"), ...checkFolder(weekly, weeklyKeep, "weekly/")];

  const { newest, previous } = planVerification(daily);
  if (!newest) return [...problems, "daily/ has no complete backup"];

  const manifestProblems = validateManifest(newestManifest);
  if (manifestProblems.length) return [...problems, ...manifestProblems.map((p) => `newest manifest: ${p}`)];

  if (!downloaded || downloaded.sha256 !== newestManifest.sha256) problems.push("the newest backup's SHA-256 does not match its manifest");
  if (!downloaded || downloaded.size !== newestManifest.sizeBytes || newest.files.archive.size !== newestManifest.sizeBytes) {
    problems.push("the newest backup's size does not match its manifest");
  }
  if (Math.abs(new Date(newestManifest.createdAt) - newest.date) > 60 * 60 * 1000) problems.push("the newest manifest's timestamp does not match its file name");
  problems.push(...checkFreshness(newestManifest.createdAt, now, maxAgeHours));

  if (previous) {
    if (validateManifest(previousManifest).length) problems.push("the previous manifest is invalid");
    else problems.push(...checkSizeRatio(newestManifest.sizeBytes, previousManifest.sizeBytes, minSizeRatio));
  }
  return problems;
}

module.exports = { DEFAULT_LIMITS, planVerification, verifyBackups };
