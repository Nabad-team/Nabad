const { LlmError } = require("../triage/ai/llmClient");

// A maximum of two generations across BOTH truncation and validation failures.
// Authentication, quota, network, timeout and provider safety failures are never
// retried. Rejected text never enters the replacement request or reaches users.
async function completeValidated({ client, messages, options, parse, correctionFor, totalTimeoutMs = null }) {
  const started = performance.now();
  let nextMessages = messages;
  let nextOptions = options;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const elapsed = performance.now() - started;
      if (totalTimeoutMs !== null && elapsed >= totalTimeoutMs) throw new LlmError("timeout");
      const remainingMs = Math.max(1000, Math.ceil((totalTimeoutMs - elapsed) / 1000) * 1000);
      const attemptOptions = totalTimeoutMs === null ? nextOptions : { ...nextOptions, timeoutMs: remainingMs };
      return parse(await client.complete(nextMessages, attemptOptions));
    } catch (error) {
      if (attempt === 1) throw error;
      if (error instanceof LlmError && error.code === "incomplete_response") {
        nextOptions = { ...options, maxTokens: Math.min(8192, Math.max(4096, options.maxTokens * 2)) };
        continue;
      }
      const correction = correctionFor(error);
      if (!correction) throw error;
      nextMessages = messages.map((message, index) => index === 0
        ? { ...message, content: `${message.content}\n\n${correction}` }
        : message);
    }
  }
}

module.exports = { completeValidated };
