// Same-site API only. Never retry writes automatically: a timed-out write may already have succeeded.
const API_BASE = "/api";
const slowRequest = path => /^\/(?:triage\/ai-assess|reports(?:\/|$)|medical-documents(?:\/|$)|visit-prep(?:\/|$))/.test(path);
export async function request(path, options = {}) {
  const { timeoutMs = slowRequest(path) ? 120000 : 30000, signal, ...fetchOptions } = options;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000) throw new RangeError("Invalid request timeout.");
  if (signal?.aborted) throw new DOMException("Request cancelled.", "AbortError");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  let timedOut = false, rejectAbort;
  const aborted = new Promise((_, reject) => {
    rejectAbort = () => reject(new DOMException("Request cancelled.", "AbortError"));
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
  });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const res = await Promise.race([fetch(API_BASE + path, {
      credentials: "include", ...fetchOptions,
      headers: { "Content-Type": "application/json", ...fetchOptions.headers },
      signal: controller.signal,
    }), aborted]);
    const data = await Promise.race([res.json().catch(() => ({})), aborted]);
    if (!res.ok) {
      const error = new Error(data.error || (res.status >= 500
        ? "Nabad is temporarily unavailable. Please try again. In an emergency in Lebanon, call 140."
        : "Request failed."));
      error.status = res.status; error.requestId = data.requestId;
      throw error;
    }
    return data;
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Request cancelled.", "AbortError");
    if (error.status !== undefined) throw error;
    const failure = new Error(timedOut
      ? "Nabad took too long to respond. Please try again. In an emergency in Lebanon, call 140."
      : "Cannot connect to Nabad. Check your connection and try again. In an emergency in Lebanon, call 140.");
    failure.status = 0; failure.code = timedOut ? "REQUEST_TIMEOUT" : "NETWORK_UNAVAILABLE";
    throw failure;
  } finally {
    clearTimeout(timer); signal?.removeEventListener("abort", cancel);
    controller.signal.removeEventListener("abort", rejectAbort);
  }
}

export const signup = (name, email, password) => request("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) });
export const login = (email, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const verifyTwoFactor = (challenge, code, rememberDevice = false) => request("/auth/2fa/verify", { method: "POST", body: JSON.stringify({ challenge, code, rememberDevice }) });
export const resendTwoFactor = (challenge) => request("/auth/2fa/resend", { method: "POST", body: JSON.stringify({ challenge }) });
export const requestPasswordReset = (email) => request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
export const resetPassword = (token, password) => request("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
export const beginTwoFactorSetup = () => request("/auth/2fa/setup", { method: "POST" });
export const enableTwoFactor = (code) => request("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) });
export const disableTwoFactor = (password) => request("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password }) });
export const logout = () => request("/auth/logout", { method: "POST" });
export const getMe = () => request("/auth/me");
export const getSession = () => request("/auth/session");
export const completeOnboarding = () => request("/auth/onboarding/complete", { method: "POST" });
export const googleLoginUrl = () => API_BASE + "/auth/google";
export const verifyEmail = (token) => request("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
export const resendVerificationEmail = () => request("/auth/verify-email/resend", { method: "POST" });
export const getEmergencyContact = (profileId, signal) => request(`/profile/emergency-contact${profileId ? `?profileId=${encodeURIComponent(profileId)}` : ""}`, { signal });
export const addEmergencyContact = (name, phone) => request("/profile/emergency-contact", { method: "POST", body: JSON.stringify({ name, phone }) });
export const updateEmergencyContact = (name, phone) => request("/profile/emergency-contact", { method: "PUT", body: JSON.stringify({ name, phone }) });
export const removeEmergencyContact = () => request("/profile/emergency-contact", { method: "DELETE" });
