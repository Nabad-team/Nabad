// Run in the same environment as the backend. Only synthetic prompts are sent;
// credentials, endpoints, source documents and generated replies are never printed.
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const { readLlmConfig, getLlmClient } = require("../src/triage/ai/llmClient");
const { answerChat } = require("../src/reports/chat");
const { analyzeReport } = require("../src/reports/analyze");
const { providerFailureDetails } = require("../src/reports/providerFailure");

async function main() {
  const config = readLlmConfig();
  const live = process.argv.includes("--live");
  console.log(JSON.stringify({ check: "configuration", configured: config.configured,
    ...(config.configured ? { provider: config.provider, model: config.model, timeoutMs: config.timeoutMs, hasApiKey: !!config.apiKey }
      : { problem: config.problem, missingVariables: ["LLM_API_URL", "LLM_MODEL"].filter((name) => !process.env[name]?.trim()) }),
  }));
  if (!config.configured) { process.exitCode = 1; return; }
  if (!live) return;
  const client = getLlmClient();
  const probes = [
    ["chat", () => answerChat({ question: "What does hemoglobin do? Explain without diagnosing anyone.", client })],
    ["report", () => analyzeReport({ question: "Explain this synthetic report without diagnosing anyone.", client,
      report: { kind: "text", text: "SYNTHETIC LAB REPORT FOR SOFTWARE TESTING. Hemoglobin: 13.5 g/dL. Reference range: 12-16 g/dL. No abnormal flag or urgent instruction is supplied. Review with the ordering clinician." },
    })],
  ];
  for (const [check, probe] of probes) {
    const start = performance.now();
    try {
      await probe();
      console.log(JSON.stringify({ check, status: "passed", durationMs: Math.round(performance.now() - start) }));
    } catch (error) {
      const issue = providerFailureDetails(error, check);
      console.log(JSON.stringify({ check, status: "failed", reason: issue?.serviceIssue || (error.name === "ReportAnalysisError" ? error.code : "internal_error"),
        ...(error.providerFailure ? { providerCode: error.providerFailure.code, httpStatus: error.providerFailure.status } : {}),
        durationMs: Math.round(performance.now() - start),
      }));
      process.exitCode = 1;
      // One provider failure is enough to diagnose connectivity/access/quota.
      if (issue) break;
    }
  }
}

// SCRUM-310: the backup model and usage limits, printed last. Names and numbers only, never keys or URLs.
function printFallbackAndLimits() {
  const { readSettings } = require("../src/triage/ai/modelAccess");
  const settings = readSettings();
  console.log(JSON.stringify({ check: "fallback_and_limits",
    fallbackConfigured: Boolean(settings.fallback), ...(settings.fallback ? { fallbackModel: settings.fallback.model } : {}),
    limits: settings.limits, quotaTimeZone: settings.timeZone, triageReservePercent: settings.triageReservePercent,
    triageDeadlineMs: settings.triageDeadlineMs, problems: settings.problems,
  }));
  if (settings.problems.length) process.exitCode = 1;
}

main().then(printFallbackAndLimits, () => { console.log(JSON.stringify({ check: "diagnostic", status: "failed", reason: "internal_error" })); process.exitCode = 1; });
