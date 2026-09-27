const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include", // sends/receives the httpOnly auth cookie
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

export const signup = (name, email, password) =>
  request("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) });

export const login = (email, password) =>
  request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const verifyTwoFactor = (challenge, code) =>
  request("/auth/2fa/verify", { method: "POST", body: JSON.stringify({ challenge, code }) });
export const requestPasswordReset = (email) =>
  request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
export const resetPassword = (token, password) =>
  request("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
export const beginTwoFactorSetup = () => request("/auth/2fa/setup", { method: "POST" });
export const enableTwoFactor = (code) => request("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) });
export const disableTwoFactor = (password, code) => request("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password, code }) });

export const logout = () => request("/auth/logout", { method: "POST" });

export const getMe = () => request("/auth/me");
