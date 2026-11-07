// Small helpers that keep secrets and data out of public logs.

// B2_ENDPOINT may be stored as "s3.eu-central-003.backblazeb2.com" or with https://. The AWS CLI
// needs a full URL and a region, and B2's region is the second label of the host.
function normalizeEndpoint(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("B2 endpoint is empty");
  let url;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error("B2 endpoint is not a valid host or URL");
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && !/^[\w-]+$/.test(url.hostname)) {
    throw new Error("B2 endpoint must use https");
  }
  const m = /^s3\.([a-z0-9-]+)\.backblazeb2\.com$/.exec(url.hostname);
  return { url: `${url.protocol}//${url.host}`, region: m ? m[1] : "us-east-1" };
}

// Turns a tool's error output into one fixed sentence that is safe to print. The raw output can hold
// hosts, collection names or counts, so it stays in a private file on the runner.
function classifyToolError(text) {
  const t = String(text || "");
  if (/authentication failed|auth(entication)? error|bad auth|Unauthorized/i.test(t)) return "authentication failed (check the read-only user and the secret)";
  if (/not authorized|requires authentication/i.test(t)) return "the user is not allowed to read what is needed";
  if (/server selection|connection refused|no reachable servers|timed out|ENOTFOUND|SRV|i\/o timeout|connection reset/i.test(t)) {
    return "could not reach the database (check Atlas network access)";
  }
  if (/unsupported|incompatible|feature compatibility|unknown (option|field)|InvalidOptions|CannotCreateIndex/i.test(t)) {
    return "the target MongoDB rejected part of the data (version or option incompatibility)";
  }
  if (/no space left/i.test(t)) return "the runner ran out of disk space";
  return "the tool failed; see the run on a private machine to debug";
}

// The id of the first failed step, from toJSON(steps) in the workflow.
function firstFailedStep(stepsJson) {
  let steps;
  try {
    steps = typeof stepsJson === "string" ? JSON.parse(stepsJson) : stepsJson;
  } catch {
    return "unknown";
  }
  const failed = Object.entries(steps || {}).find(([, s]) => s && (s.outcome === "failure" || s.conclusion === "failure"));
  return failed ? failed[0] : "unknown";
}

module.exports = { normalizeEndpoint, classifyToolError, firstFailedStep };
