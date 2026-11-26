// Time to a symptom check result, on STAGING only (SCRUM-349).
// Usage (from the repo root): node loadtest/time-to-result/time-to-result.js <results.json>
// One throwaway account (example.invalid, random password, never printed), 5 mild checks about 1 minute apart,
// each timed from sending POST /api/triage/ai-assess to the full response (90 s limit per request). Then the
// account is deleted with DELETE /api/profile/me, the same call as the app's "Delete account" button (retried).
// Prints and saves only timings, HTTP statuses, urgency levels and whether the AI answered. Each check uses one
// of the account's daily AI symptom checks and the shared staging AI quota, so keep it to 5.
// TTR_SECRET_FILE (optional): a path OUTSIDE the repository where the email and password are written, so the
// account can still be signed into and deleted by hand if the run is cut off. Delete that file afterwards.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

const BASE = "https://nabad-staging.vercel.app";
if (new URL(BASE).host !== "nabad-staging.vercel.app") throw new Error("staging only");
const out = process.argv[2];
const GAP_MS = 60000;
const SYMPTOMS = [
  "mild sore throat since yesterday",
  "slightly runny nose and sneezing for two days",
  "mild headache after a long day at the computer",
  "small paper cut on my finger this morning",
  "mild muscle soreness in my legs after exercise yesterday",
];

let cookie = "";
async function call(method, path, body) {
  const started = performance.now();
  const res = await fetch(BASE + path, {
    signal: AbortSignal.timeout(90000), // never hang: a check that takes over 90 s counts as failed
    method,
    headers: { "Content-Type": "application/json", Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const ms = Math.round(performance.now() - started);
  const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const token = set.map((c) => c.split(";")[0]).find((c) => c.startsWith("accessToken="));
  if (token) cookie = token;
  let json = null;
  try { json = JSON.parse(text); } catch { /* 204 or HTML */ }
  return { status: res.status, ms, json };
}

(async () => {
  const email = `nabad-timing-${crypto.randomBytes(5).toString("hex")}@example.invalid`;
  const password = `Tt-${crypto.randomBytes(18).toString("base64url")}-9q`;
  const secretFile = process.env.TTR_SECRET_FILE;
  if (secretFile) {
    const repo = path.resolve(__dirname, "..", "..");
    if (path.resolve(secretFile).toLowerCase().startsWith(repo.toLowerCase() + path.sep)) throw new Error("TTR_SECRET_FILE must be outside the repository");
    fs.writeFileSync(secretFile, JSON.stringify({ email, password }) + "\n", { mode: 0o600 });
  }
  const record = { target: BASE, startedAt: new Date().toISOString(), checks: [] };
  const signup = await call("POST", "/api/auth/signup", { name: "Timing Test", email, password });
  record.signupStatus = signup.status;
  console.log(`signup: HTTP ${signup.status}`);
  if (signup.status !== 201 || !cookie) throw new Error(`signup failed (HTTP ${signup.status}); nothing else was run`);
  try {
    for (const [i, symptoms] of SYMPTOMS.entries()) {
      if (i) await new Promise((r) => setTimeout(r, GAP_MS));
      const at = new Date().toISOString();
      let r;
      try { r = await call("POST", "/api/triage/ai-assess", { symptoms }); }
      catch (e) { r = { status: null, ms: null, json: null, error: e.name }; }
      const result = r.json?.result || r.json || {};
      const ai = result.ai || {};
      const row = { n: i + 1, at, status: r.status, ms: r.ms, error: r.error || undefined, urgency: result.urgency || result.level || null,
        aiUsed: ai.used ?? null, aiReason: ai.used ? null : (ai.reason || null) };
      record.checks.push(row);
      console.log(JSON.stringify(row));
      if (out) fs.writeFileSync(out, JSON.stringify(record, null, 2) + "\n");
      if (r.status === 429) { console.log("429: stopping the checks"); break; }
    }
  } finally {
    // Retry the delete: the account must not be left behind (the password exists only in this process).
    let del = { status: null };
    for (let attempt = 1; attempt <= 5 && del.status !== 204; attempt++) {
      try { del = await call("DELETE", "/api/profile/me", { confirm: "DELETE", password }); }
      catch (e) { console.log(`delete attempt ${attempt}: ${e.name}`); await new Promise((r) => setTimeout(r, 15000)); }
    }
    record.deleteStatus = del.status;
    const after = await call("GET", "/api/auth/me");
    record.meAfterDelete = after.status;
    console.log(`delete account: HTTP ${del.status}; /api/auth/me afterwards: HTTP ${after.status}`);
    record.endedAt = new Date().toISOString();
    if (out) fs.writeFileSync(out, JSON.stringify(record, null, 2) + "\n");
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
