// Same-site path, forwarded to the backend by the rewrite in next.config.js.
const API_BASE = "/api";

export async function request(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || "Request failed.");
    error.status = res.status; // lets callers tell "signed out" (401) apart from a network problem
    throw error;
  }
  return data;
}

export const signup = (name, email, password) => request("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) });
export const login = (email, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const verifyTwoFactor = (challenge, code) => request("/auth/2fa/verify", { method: "POST", body: JSON.stringify({ challenge, code }) });
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
export const getEmergencyContact = () => request("/profile/emergency-contact");
export const addEmergencyContact = (name, phone) => request("/profile/emergency-contact", { method: "POST", body: JSON.stringify({ name, phone }) });
