// (3) Signed-in users whose pages call GET /auth/me.
// setup() signs up a pool of accounts once; each virtual user then reuses one of their cookies.
// /me checks the token, reads the user from MongoDB and renews the cookie (sliding expiry).
import http from "k6/http";
import { check, sleep } from "k6";
import { API, JSON_HEADERS, TIMEOUT, levelOptions, summaryTo } from "./lib.js";

// Keep cookies between iterations (k6 clears them by default), like a browser tab that stays open.
export const options = { ...levelOptions(["me"]), noCookiesReset: true };
const ACCOUNTS = 25;

export function setup() {
  const tokens = [];
  for (let i = 0; i < ACCOUNTS; i++) {
    const email = `lt-me-${i}-${Date.now()}@example.test`;
    const res = http.post(`${API}/auth/signup`, JSON.stringify({ name: "Load Test", email, password: "Load test password 123!" }), { headers: JSON_HEADERS, tags: { name: "setup" } });
    if (res.status !== 201) throw new Error(`setup signup failed: ${res.status}`);
    tokens.push(res.cookies.accessToken[0].value);
  }
  return { tokens };
}

export default function ({ tokens }) {
  // First iteration: sign this VU in. Later renewals from /me update its cookie jar like a browser.
  if (__ITER === 0) http.cookieJar().set(API, "accessToken", tokens[__VU % tokens.length]);
  const me = http.get(`${API}/auth/me`, { tags: { name: "me" }, timeout: TIMEOUT });
  check(me, { "me is 200": (r) => r.status === 200 });
  sleep(1);
}

export const handleSummary = summaryTo;
