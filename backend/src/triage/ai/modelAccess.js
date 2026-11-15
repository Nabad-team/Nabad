// SCRUM-310: "As a user, I want triage to keep working when the AI is slow, down or over its limit,
// so that I always get guidance."
//
// Every part of the API that talks to the language model gets its client from here:
//
//   getTriageLlmClient()  the symptom check. Tries the main model, then the backup model.
//   getLlmClient()        the health assistant and report review. Main model only.
//
// Three things protect the service and the free quota:
//
//   1. A backup model (LLM_FALLBACK_*). If the main model times out, can't be reached, answers with an
//      error (429 quota, 5xx, 401...) or sends an unreadable reply, the same request goes to the backup.
//   2. Usage limits (LLM_MAX_CALLS_PER_MINUTE / _PER_DAY, and the same with LLM_FALLBACK_ for the backup).
//      Nabad stops calling a model before the provider's free quota runs out, instead of finding out from
//      a 429. The last part of each day's budget (LLM_TRIAGE_RESERVE_PERCENT, default 20%) is kept for
//      symptom checks: the health assistant can't use up the quota that triage needs.
//   3. A short pause after a provider says no. A 429 pauses that model for a minute, a 401/403 (bad key)
//      for ten minutes, and three failures in a row for 30 seconds. During the pause, symptom checks
//      go straight to the backup (or the rules) instead of waiting for a timeout on every check.
//
// None of this can stop a symptom check from getting an answer: when no model can be used, the client
// throws an LlmError, and aiTriage.js answers with the rules alone (and the red-flag rules never call
// a model at all). The counters are kept in memory, per server process, and start again on a restart;
// the provider's own limit is still there behind them.
//
// Settings (all optional; unset means no limit, as before):
//   LLM_FALLBACK_MODEL         the backup model's name. Setting it turns the backup on.
//   LLM_FALLBACK_API_URL       defaults to LLM_API_URL (e.g. a second Gemini model on the same key)
//   LLM_FALLBACK_PROVIDER      defaults to LLM_PROVIDER
//   LLM_FALLBACK_API_KEY       defaults to LLM_API_KEY, but only when the URL is the same: the main key is
//                              never sent to a different host.
//   LLM_FALLBACK_TIMEOUT_MS    defaults to LLM_TIMEOUT_MS
//   LLM_MAX_CALLS_PER_MINUTE, LLM_MAX_CALLS_PER_DAY                    the main model's budget
//   LLM_FALLBACK_MAX_CALLS_PER_MINUTE, LLM_FALLBACK_MAX_CALLS_PER_DAY  the backup model's budget
//   LLM_QUOTA_TIME_ZONE        when the daily budget starts again (default UTC; Gemini resets at
//                              midnight America/Los_Angeles)
//   LLM_TRIAGE_RESERVE_PERCENT share of the daily budget only symptom checks may use (0-90, default 20)
//   LLM_TRIAGE_DEADLINE_MS     the most time the models get in one symptom check, both tries together
//                              (3000-120000). With a backup, the main model gets at most 60% of it.

const { readLlmConfig, createLlmClient, LlmError } = require("./llmClient");

const MINUTE = 60 * 1000;
const PAUSE_AFTER_QUOTA_MS = 60 * 1000;
const PAUSE_AFTER_ACCESS_ERROR_MS = 10 * 60 * 1000;
const PAUSE_AFTER_FAILURES_MS = 30 * 1000;
const FAILURES_BEFORE_PAUSE = 3;
const DEFAULT_TRIAGE_RESERVE_PERCENT = 20;
const PRIMARY_SHARE_OF_DEADLINE = 0.6;
const MIN_ATTEMPT_MS = 1000;

const present = (value) => typeof value === "string" && value.trim() !== "";

// ---------- Settings ----------

// A whole number in [min, max], or null when unset. Throws a short message when invalid, so a
// misconfiguration is visible (the route turns it into "no limit" and logs it, see readSettings).
function readCount(env, name, min, max) {
  if (!present(env[name])) return null;
  const value = Number(env[name]);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be a whole number from ${min} to ${max}.`);
  return value;
}

function validTimeZone(zone) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

// The backup model's settings, as the same variables readLlmConfig() reads for the main model.
function fallbackEnv(env) {
  if (!present(env.LLM_FALLBACK_MODEL)) return null;
  const url = present(env.LLM_FALLBACK_API_URL) ? env.LLM_FALLBACK_API_URL : env.LLM_API_URL;
  const sameUrl = present(url) && present(env.LLM_API_URL) && url.trim().replace(/\/+$/, "") === env.LLM_API_URL.trim().replace(/\/+$/, "");
  return {
    ...env,
    LLM_API_URL: url,
    LLM_MODEL: env.LLM_FALLBACK_MODEL,
    LLM_PROVIDER: present(env.LLM_FALLBACK_PROVIDER) ? env.LLM_FALLBACK_PROVIDER : env.LLM_PROVIDER,
    // Never send the main model's key to a different host.
    LLM_API_KEY: present(env.LLM_FALLBACK_API_KEY) ? env.LLM_FALLBACK_API_KEY : sameUrl ? env.LLM_API_KEY : undefined,
    LLM_TIMEOUT_MS: present(env.LLM_FALLBACK_TIMEOUT_MS) ? env.LLM_FALLBACK_TIMEOUT_MS : env.LLM_TIMEOUT_MS,
  };
}

// Everything this module needs from the environment. Never throws: a bad value is reported in
// `problems` (fixed messages, no secrets) and that setting is treated as unset.
function readSettings(env = process.env) {
  const problems = [];
  const count = (name, min, max) => {
    try {
      return readCount(env, name, min, max);
    } catch (error) {
      problems.push(error.message);
      return null;
    }
  };
  const primary = readLlmConfig(env);
  const backupEnv = fallbackEnv(env);
  const fallback = backupEnv ? readLlmConfig(backupEnv) : null;
  if (fallback && !fallback.configured) problems.push(`The backup model is not usable (${fallback.problem}).`);
  const timeZone = present(env.LLM_QUOTA_TIME_ZONE) ? env.LLM_QUOTA_TIME_ZONE.trim() : "UTC";
  if (!validTimeZone(timeZone)) problems.push("LLM_QUOTA_TIME_ZONE is not a known time zone.");
  const reserve = count("LLM_TRIAGE_RESERVE_PERCENT", 0, 90);
  return {
    primary,
    fallback: fallback?.configured ? fallback : null,
    limits: {
      primary: { perMinute: count("LLM_MAX_CALLS_PER_MINUTE", 1, 100000), perDay: count("LLM_MAX_CALLS_PER_DAY", 1, 10000000) },
      fallback: { perMinute: count("LLM_FALLBACK_MAX_CALLS_PER_MINUTE", 1, 100000), perDay: count("LLM_FALLBACK_MAX_CALLS_PER_DAY", 1, 10000000) },
    },
    timeZone: validTimeZone(timeZone) ? timeZone : "UTC",
    triageReservePercent: reserve === null ? DEFAULT_TRIAGE_RESERVE_PERCENT : reserve,
    triageDeadlineMs: count("LLM_TRIAGE_DEADLINE_MS", 3000, 120000),
    problems,
  };
}

// ---------- Budgets (in memory, per model) ----------

// key -> { minute: [call times], day, dayCount, pausedUntil, failures }
const budgets = new Map();

function dayKey(now, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function budgetFor(config) {
  const key = `${config.endpoint} ${config.model}`;
  if (!budgets.has(key)) budgets.set(key, { minute: [], day: null, dayCount: 0, pausedUntil: 0, failures: 0 });
  return budgets.get(key);
}

// Whether one more call is allowed right now, and if so, counts it. Synchronous, so two requests
// arriving together can't both take the last call. purpose: "triage" or "assistant".
// Returns null when the call may go ahead, or the LlmError code that explains why not.
function takeCall(config, limits, purpose, settings, now = Date.now()) {
  const budget = budgetFor(config);
  // Only symptom checks skip a paused model: they have the backup and the rules to answer instead.
  // The health assistant still calls it and shows the provider's own error, as before.
  if (purpose === "triage" && budget.pausedUntil > now) return "model_paused";
  const today = dayKey(now, settings.timeZone);
  if (budget.day !== today) {
    budget.day = today;
    budget.dayCount = 0;
  }
  budget.minute = budget.minute.filter((time) => now - time < MINUTE);
  if (limits.perMinute !== null && budget.minute.length >= limits.perMinute) return "usage_limit";
  if (limits.perDay !== null) {
    // The health assistant stops early, so the last part of the day is kept for symptom checks.
    const share = purpose === "triage" ? 1 : 1 - settings.triageReservePercent / 100;
    if (budget.dayCount >= Math.floor(limits.perDay * share)) return "usage_limit";
  }
  budget.minute.push(now);
  budget.dayCount += 1;
  return null;
}

// What the answer from the provider says about calling this model again soon.
function recordOutcome(config, error, now = Date.now()) {
  const budget = budgetFor(config);
  if (!error) {
    budget.failures = 0;
    return;
  }
  if (error.code === "http_error" && error.status === 429) {
    budget.pausedUntil = now + PAUSE_AFTER_QUOTA_MS;
  } else if (error.code === "http_error" && [401, 403].includes(error.status)) {
    budget.pausedUntil = now + PAUSE_AFTER_ACCESS_ERROR_MS;
  } else if (["timeout", "network", "http_error"].includes(error.code)) {
    budget.failures += 1;
    if (budget.failures >= FAILURES_BEFORE_PAUSE) {
      budget.failures = 0;
      budget.pausedUntil = now + PAUSE_AFTER_FAILURES_MS;
    }
  }
}

// For the tests, and for an operator who has just fixed a key.
function resetModelBudgets() {
  budgets.clear();
}

// ---------- Clients ----------

// One model with its budget. Throws LlmError("usage_limit" | "model_paused") without calling the
// provider when the budget says no.
function budgeted(config, limits, purpose, settings, fetchImpl) {
  const client = createLlmClient(config, fetchImpl);
  async function complete(messages, options = {}) {
    const refused = takeCall(config, limits, purpose, settings);
    // Status 429, like the provider's own "too many requests", so the health assistant shows its usual
    // "usage limit" message (reports/providerFailure.js). Nothing was sent to the provider.
    if (refused) throw new LlmError(refused, refused === "usage_limit" ? 429 : undefined);
    try {
      const reply = await client.complete(messages, options);
      recordOutcome(config, null);
      return reply;
    } catch (error) {
      if (error instanceof LlmError) recordOutcome(config, error);
      throw error;
    }
  }
  return { complete, model: config.model, timeoutMs: config.timeoutMs };
}

// The health assistant and report review: the main model, within its budget, keeping the triage reserve.
// null when AI is not configured, exactly like llmClient.getLlmClient().
function getLlmClient(env = process.env, fetchImpl = globalThis.fetch) {
  const settings = readSettings(env);
  if (!settings.primary.configured) return null;
  return budgeted(settings.primary, settings.limits.primary, "assistant", settings, fetchImpl);
}

// Errors where a second model is worth trying. A programming error (TypeError...) is not.
const TRY_BACKUP = new Set(["timeout", "network", "http_error", "bad_response", "incomplete_response", "provider_blocked", "usage_limit", "model_paused"]);

// The symptom check: the main model, then the backup. null when neither is configured.
// After a successful call, `answeredBy` is "primary" or "fallback" (the client is made per request).
function getTriageLlmClient(env = process.env, fetchImpl = globalThis.fetch) {
  const settings = readSettings(env);
  const models = [];
  if (settings.primary.configured) models.push({ role: "primary", client: budgeted(settings.primary, settings.limits.primary, "triage", settings, fetchImpl) });
  if (settings.fallback) models.push({ role: "fallback", client: budgeted(settings.fallback, settings.limits.fallback, "triage", settings, fetchImpl) });
  if (!models.length) return null;

  const wrapper = {
    model: models[0].client.model,
    answeredBy: null,
    // Each model that was tried and why it was not used, e.g. [{ role: "primary", reason: "timeout" }].
    attempts: [],
    async complete(messages, options = {}) {
      const started = Date.now();
      const deadline = settings.triageDeadlineMs;
      let lastError = null;
      for (const [index, { role, client }] of models.entries()) {
        let timeoutMs = options.timeoutMs;
        if (deadline !== null) {
          const left = deadline - (Date.now() - started);
          const isLast = index === models.length - 1;
          // The main model can't use the whole deadline when a backup is waiting.
          const share = isLast ? left : Math.min(left, Math.floor(deadline * PRIMARY_SHARE_OF_DEADLINE));
          if (share < MIN_ATTEMPT_MS) {
            wrapper.attempts.push({ role, reason: "deadline" });
            lastError = lastError || new LlmError("timeout");
            continue;
          }
          timeoutMs = Math.min(share, timeoutMs ?? share);
        }
        try {
          const reply = await client.complete(messages, { ...options, ...(timeoutMs !== undefined ? { timeoutMs } : {}) });
          wrapper.answeredBy = role;
          return reply;
        } catch (error) {
          if (!(error instanceof LlmError) || !TRY_BACKUP.has(error.code)) throw error;
          wrapper.attempts.push({ role, reason: error.code });
          // A real provider failure explains more than "the backup was over its limit".
          if (!lastError || !["usage_limit", "model_paused"].includes(error.code)) lastError = error;
        }
      }
      throw lastError;
    },
  };
  return wrapper;
}

module.exports = {
  getLlmClient,
  getTriageLlmClient,
  readSettings,
  resetModelBudgets,
  // For the tests.
  takeCall,
  recordOutcome,
  PAUSE_AFTER_QUOTA_MS,
  PAUSE_AFTER_ACCESS_ERROR_MS,
  PAUSE_AFTER_FAILURES_MS,
  FAILURES_BEFORE_PAUSE,
};
