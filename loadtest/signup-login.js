// (2) New users signing up and then logging in, all at the same time.
// Both steps hash or check the password with bcrypt (cost 12), the most CPU-heavy work in the backend.
import http from "k6/http";
import { check, sleep } from "k6";
import { API, JSON_HEADERS, TIMEOUT, levelOptions, summaryTo } from "./lib.js";

export const options = levelOptions(["signup", "login"]);
const password = "Load test password 123!";

export default function () {
  const email = `lt-${__VU}-${__ITER}-${Date.now()}@example.test`;
  const params = (name) => ({ headers: JSON_HEADERS, tags: { name }, timeout: TIMEOUT });
  const signup = http.post(`${API}/auth/signup`, JSON.stringify({ name: "Load Test", email, password }), params("signup"));
  check(signup, { "signup is 201": (r) => r.status === 201 });
  const login = http.post(`${API}/auth/login`, JSON.stringify({ email, password }), params("login"));
  check(login, { "login is 200": (r) => r.status === 200 });
  sleep(1);
}

export const handleSummary = summaryTo;
