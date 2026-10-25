const { test } = require("node:test");
const assert = require("node:assert/strict");
const { providerFailureDetails } = require("../src/reports/providerFailure");

test("provider failures return fixed user messages and actionable categories without leaking raw details", () => {
  for (const [status, issue] of [[400, "request_rejected"], [401, "access"], [403, "access"], [404, "model_unavailable"], [413, "request_rejected"], [415, "request_rejected"], [422, "request_rejected"], [429, "usage_limit"], [503, "unavailable"]]) {
    const result = providerFailureDetails({ code: "provider_unavailable", message: "secret API key and uploaded text", providerFailure: { code: "http_error", status, body: "secret API key and uploaded text" } });
    assert.equal(result.serviceIssue, issue);
    assert.match(result.message, /No analysis was completed/);
    assert.doesNotMatch(JSON.stringify(result), /secret|uploaded text/);
  }
});

test("network and timeout errors are distinguished and safety rejections keep their own handling", () => {
  assert.equal(providerFailureDetails({ code: "provider_unavailable", providerFailure: { code: "network" } }).serviceIssue, "connection");
  const timeout = providerFailureDetails({ code: "timeout" }, "chat");
  assert.equal(timeout.serviceIssue, "timeout");
  assert.match(timeout.message, /No AI answer was generated/);
  assert.equal(providerFailureDetails({ code: "unsafe_response" }), null);
  assert.equal(providerFailureDetails({ code: "unsupported_quote" }), null);
});
