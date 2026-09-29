// (1) Visitors opening public pages. The pages themselves are static files on Vercel; what reaches
// the backend is what every page does on load: SessionTimeout asks GET /auth/session, which answers
// 401 for a visitor who is not signed in. /health stands in for the landing page's uptime ping.
import http from "k6/http";
import { check, sleep } from "k6";
import { API, TIMEOUT, levelOptions, summaryTo } from "./lib.js";

export const options = levelOptions(["session", "health"]);
http.setResponseCallback(http.expectedStatuses(200, 401));

export default function () {
  const session = http.get(`${API}/auth/session`, { tags: { name: "session" }, timeout: TIMEOUT });
  check(session, { "anonymous session is 401": (r) => r.status === 401 });
  const health = http.get(`${API}/health`, { tags: { name: "health" }, timeout: TIMEOUT });
  check(health, { "health is 200": (r) => r.status === 200 });
  sleep(1); // a visitor reads the page before the next click
}

export const handleSummary = summaryTo;
