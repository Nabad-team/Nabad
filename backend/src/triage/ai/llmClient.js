// SCRUM-180: the connection to the language model behind AI triage.
//
// One small client for any provider with an OpenAI-compatible "chat completions" API
// (OpenAI, Groq, Google Gemini, OpenRouter, or a local Ollama). The provider is chosen
// only by environment variables, so switching provider never changes the code:
//
//   LLM_API_URL     base URL, e.g. https://api.groq.com/openai/v1 (the client adds /chat/completions)
//   LLM_API_KEY     the provider's key (optional for a local Ollama)
//   LLM_MODEL       the model name, e.g. llama-3.3-70b-versatile
//   LLM_TIMEOUT_MS  optional, default 15000 (1000 to 60000)
//
// If these are missing or invalid, AI triage is simply off and the rules answer alone.
// Errors carry a short code only, never the provider's message or the reply text: those
// can echo the user's symptoms, which are health data and must not reach the logs.

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_REPLY_CHARS = 8000;
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

class LlmError extends Error {
  constructor(code, status) {
    super(`LLM request failed: ${code}`);
    this.name = "LlmError";
    this.code = code; // "timeout" | "network" | "http_error" | "bad_response"
    if (status !== undefined) this.status = status;
  }
}

const present = (value) => typeof value === "string" && value.trim() !== "";

// Returns { configured: true, ... } or { configured: false, problem } with a short reason.
function readLlmConfig(env = process.env) {
  if (!present(env.LLM_API_URL) || !present(env.LLM_MODEL)) return { configured: false, problem: "not_configured" };
  let url;
  try {
    url = new URL(env.LLM_API_URL.trim());
  } catch {
    return { configured: false, problem: "invalid_url" };
  }
  // Symptoms are health data: they only travel over HTTPS. Plain HTTP is allowed for a model
  // running on this same machine (a local Ollama in development, or a fake model in tests).
  const local = url.protocol === "http:" && LOCAL_HOSTS.includes(url.hostname);
  if (url.protocol !== "https:" && !local) return { configured: false, problem: "insecure_url" };
  if (url.username || url.password) return { configured: false, problem: "invalid_url" };

  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (present(env.LLM_TIMEOUT_MS)) {
    timeoutMs = Number(env.LLM_TIMEOUT_MS);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) return { configured: false, problem: "invalid_timeout" };
  }
  return {
    configured: true,
    endpoint: url.href.replace(/\/+$/, "") + "/chat/completions",
    apiKey: present(env.LLM_API_KEY) ? env.LLM_API_KEY.trim() : null,
    model: env.LLM_MODEL.trim(),
    timeoutMs,
  };
}

// fetchImpl is injectable so the unit tests can stand in for the provider.
function createLlmClient(config, fetchImpl = globalThis.fetch) {
  if (!config?.configured) throw new Error("createLlmClient needs a configured LLM config.");

  async function complete(messages) {
    // The timeout covers the whole exchange, including reading the reply body.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      return await send(messages, controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  async function send(messages, signal) {
    let response;
    try {
      response = await fetchImpl(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0, // the same symptoms should get the same answer
          max_tokens: 600,
          response_format: { type: "json_object" },
        }),
        signal,
      });
    } catch (error) {
      throw new LlmError(signal.aborted ? "timeout" : "network");
    }

    if (!response.ok) throw new LlmError("http_error", response.status);

    let data;
    try {
      data = await response.json();
    } catch {
      throw new LlmError(signal.aborted ? "timeout" : "bad_response");
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim() || content.length > MAX_REPLY_CHARS) {
      throw new LlmError("bad_response");
    }
    return content;
  }

  return { complete, model: config.model };
}

// The client for the current environment, or null when AI triage is off.
function getLlmClient(env = process.env, fetchImpl = globalThis.fetch) {
  const config = readLlmConfig(env);
  return config.configured ? createLlmClient(config, fetchImpl) : null;
}

module.exports = { readLlmConfig, createLlmClient, getLlmClient, LlmError, DEFAULT_TIMEOUT_MS, MAX_REPLY_CHARS };
