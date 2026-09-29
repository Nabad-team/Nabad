// Shared settings for the k6 scripts.
export const API = __ENV.BASE_URL || "http://localhost:5100/api";
// The backend rejects writes whose Origin is not CLIENT_ORIGIN (see backend/src/app.js).
export const JSON_HEADERS = { "Content-Type": "application/json", Origin: "http://localhost:3000" };
export const TIMEOUT = "30s";

// One load level: ramp to VUS users in 5s, then hold them for DURATION.
// run-all.js runs each script at 10, 50, 100, 250 and 500 users.
export function levelOptions(tagNames = []) {
  const vus = Number(__ENV.VUS || 10);
  const thresholds = {};
  // A threshold on a tag makes k6 report that request type separately; it never fails the run.
  for (const name of tagNames) {
    thresholds[`http_req_duration{name:${name}}`] = ["p(95)>=0"];
    thresholds[`http_reqs{name:${name}}`] = ["count>=0"];
    thresholds[`http_req_failed{name:${name}}`] = ["rate>=0"];
  }
  return {
    stages: [{ duration: "5s", target: vus }, { duration: __ENV.DURATION || "30s", target: vus }],
    thresholds,
    summaryTrendStats: ["avg", "med", "p(95)", "max"],
  };
}

// Writes k6's end-of-test numbers to SUMMARY_FILE for run-all.js.
export function summaryTo(data) {
  return { [__ENV.SUMMARY_FILE || "summary.json"]: JSON.stringify(data) };
}
