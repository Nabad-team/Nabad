// SCRUM-180: the connection to the language model behind AI triage.
//
// One client for OpenAI-compatible providers and Ollama's native chat API. The provider
// is selected by environment variables; Ollama can run on infrastructure the operator controls:
//
//   LLM_PROVIDER    "ollama" (native /api/chat) or "openai-compatible" (default)
//   LLM_API_URL     base URL, e.g. https://ai.example.com (Ollama adds /api/chat)
//   LLM_API_KEY     optional bearer token for a protected self-hosted endpoint
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
  // Symptoms are health data: hosted model calls use HTTPS. Plain HTTP is allowed for loopback
  // development, or for the named Ollama service on a private Docker network when explicitly enabled.
  const local = url.protocol === "http:" && LOCAL_HOSTS.includes(url.hostname);
  const privateOllama = url.protocol === "http:" && url.hostname === "ollama" && url.port === "11434" && env.LLM_ALLOW_INSECURE_HTTP === "true";
  if (url.protocol !== "https:" && !local && !privateOllama) return { configured: false, problem: "insecure_url" };
  if (url.username || url.password) return { configured: false, problem: "invalid_url" };
  const provider = present(env.LLM_PROVIDER) ? env.LLM_PROVIDER.trim().toLowerCase() : "openai-compatible";
  if (!["ollama", "openai-compatible"].includes(provider)) return { configured: false, problem: "invalid_provider" };

  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (present(env.LLM_TIMEOUT_MS)) {
    timeoutMs = Number(env.LLM_TIMEOUT_MS);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) return { configured: false, problem: "invalid_timeout" };
  }
  return {
    configured: true,
    endpoint: url.href.replace(/\/+$/, "") + (provider === "ollama" ? "/api/chat" : "/chat/completions"),
    provider,
    apiKey: present(env.LLM_API_KEY) ? env.LLM_API_KEY.trim() : null,
    model: env.LLM_MODEL.trim(),
    timeoutMs,
  };
}

// fetchImpl is injectable so the unit tests can stand in for the provider.
function createLlmClient(config, fetchImpl = globalThis.fetch) {
  if (!config?.configured) throw new Error("createLlmClient needs a configured LLM config.");

  async function complete(messages, { maxTokens = 600, reasoningEffort } = {}) {
    // The timeout covers the whole exchange, including reading the reply body.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      return await send(messages, controller.signal, maxTokens, reasoningEffort);
    } finally {
      clearTimeout(timer);
    }
  }

  async function send(messages, signal, maxTokens, reasoningEffort) {
    let requestBody;
    try {
      const geminiThree = config.provider === "openai-compatible" && /^gemini-3(?:\.|-)/i.test(config.model);
      requestBody = config.provider === "ollama"
        ? { model: config.model, messages: toOllamaMessages(messages), stream: false, format: "json", options: { temperature: 0, num_predict: maxTokens } }
        : {
          model: config.model,
          messages,
          ...(!geminiThree ? { temperature: 0 } : {}),
          ...(geminiThree && ["low", "medium", "high"].includes(reasoningEffort) ? { reasoning_effort: reasoningEffort } : {}),
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
        };
    } catch {
      throw new LlmError("bad_response");
    }
    let response;
    try {
      response = await fetchImpl(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify(requestBody),
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
    const content = config.provider === "ollama" ? data?.message?.content : data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim() || content.length > MAX_REPLY_CHARS) {
      throw new LlmError("bad_response");
    }
    return content;
  }

  return { complete, model: config.model };
}

function toOllamaMessages(messages) {
  return messages.map((message) => {
    if (typeof message.content === "string") return { role: message.role, content: message.content };
    const text = [];
    const images = [];
    for (const part of message.content || []) {
      if (part.type === "text" && typeof part.text === "string") text.push(part.text);
      if (part.type === "image_url") {
        const source = typeof part.image_url === "string" ? part.image_url : part.image_url?.url;
        const match = typeof source === "string" && source.match(/^data:[^;,]+;base64,([A-Za-z0-9+/=\s]+)$/);
        if (!match) throw new TypeError("Ollama images must be base64 data URLs");
        images.push(match[1].replace(/\s+/g, ""));
      }
    }
    return { role: message.role, content: text.join("\n"), ...(images.length ? { images } : {}) };
  });
}

// The client for the current environment, or null when AI triage is off.
function getLlmClient(env = process.env, fetchImpl = globalThis.fetch) {
  const config = readLlmConfig(env);
  return config.configured ? createLlmClient(config, fetchImpl) : null;
}

module.exports = { readLlmConfig, createLlmClient, getLlmClient, LlmError, DEFAULT_TIMEOUT_MS, MAX_REPLY_CHARS };
