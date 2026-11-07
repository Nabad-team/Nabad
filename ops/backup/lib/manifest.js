// The plain manifest stored next to each encrypted backup. It is readable without the private key,
// so it holds only what's safe in a public place: when, how big, the SHA-256 of the encrypted file
// and the tool versions. No collection names, no counts.

const MANIFEST_VERSION = 1;
const SHA256 = /^[0-9a-f]{64}$/;
const ALLOWED_KEYS = ["manifestVersion", "createdAt", "sizeBytes", "sha256", "tools"];
const TOOL_KEYS = ["mongodump", "age", "restoreCheckMongo"];

function buildManifest({ createdAt, sizeBytes, sha256, tools }) {
  const manifest = {
    manifestVersion: MANIFEST_VERSION,
    createdAt: new Date(createdAt).toISOString(),
    sizeBytes,
    sha256,
    tools: Object.fromEntries(TOOL_KEYS.map((k) => [k, tools && tools[k]])),
  };
  const problems = validateManifest(manifest);
  if (problems.length) throw new Error(`Invalid manifest: ${problems.join("; ")}`);
  return manifest;
}

// Returns a list of problems (empty when valid). Messages never echo values from the manifest.
function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return ["manifest is not an object"];
  const problems = [];
  const extra = Object.keys(manifest).filter((k) => !ALLOWED_KEYS.includes(k));
  if (extra.length) problems.push("manifest has unexpected fields");
  if (manifest.manifestVersion !== MANIFEST_VERSION) problems.push("unsupported manifest version");
  if (typeof manifest.createdAt !== "string" || Number.isNaN(Date.parse(manifest.createdAt)) || new Date(manifest.createdAt).toISOString() !== manifest.createdAt) {
    problems.push("createdAt is not an ISO timestamp");
  }
  if (!Number.isSafeInteger(manifest.sizeBytes) || manifest.sizeBytes <= 0) problems.push("sizeBytes is not a positive integer");
  if (typeof manifest.sha256 !== "string" || !SHA256.test(manifest.sha256)) problems.push("sha256 is not a lowercase hex SHA-256");
  const tools = manifest.tools;
  if (!tools || typeof tools !== "object" || Array.isArray(tools)) {
    problems.push("tools is missing");
  } else {
    if (Object.keys(tools).some((k) => !TOOL_KEYS.includes(k))) problems.push("tools has unexpected fields");
    for (const k of TOOL_KEYS) {
      if (typeof tools[k] !== "string" || !/^[0-9A-Za-z.+_-]{1,40}$/.test(tools[k])) problems.push(`tools.${k} is missing`);
    }
  }
  return problems;
}

module.exports = { MANIFEST_VERSION, buildManifest, validateManifest };
