const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeEndpoint, classifyToolError, firstFailedStep } = require("../lib/safety");

test("normalizes the B2 endpoint with or without a scheme and finds its region", () => {
  for (const value of ["s3.eu-central-003.backblazeb2.com", "https://s3.eu-central-003.backblazeb2.com/", " https://s3.eu-central-003.backblazeb2.com "]) {
    assert.deepEqual(normalizeEndpoint(value), { url: "https://s3.eu-central-003.backblazeb2.com", region: "eu-central-003" });
  }
});

test("allows plain http only for a local test server", () => {
  assert.deepEqual(normalizeEndpoint("http://minio:9000"), { url: "http://minio:9000", region: "us-east-1" });
  assert.throws(() => normalizeEndpoint("http://s3.eu-central-003.backblazeb2.com"), /https/);
  assert.throws(() => normalizeEndpoint(""), /empty/);
});

test("classifies tool errors into fixed sentences without echoing the output", () => {
  const cases = [
    ["Failed: can't create session: connection() error occurred during connection handshake: auth error: sasl conversation error: unable to authenticate using mechanism \"SCRAM-SHA-1\": (AtlasError) bad auth : Authentication failed.", /authentication failed/],
    ["Failed: can't create session: failed to connect to mongodb+srv://u:p@nabad.example.mongodb.net: server selection error: context deadline exceeded", /Atlas network access/],
    ["Failed: nabad_production.users: error creating indexes: (CannotCreateIndex) unsupported option", /incompatibility/],
    ["something else entirely about users (12 documents)", /tool failed/],
  ];
  for (const [text, expected] of cases) {
    const sentence = classifyToolError(text);
    assert.match(sentence, expected);
    assert.doesNotMatch(sentence, /mongodb\+srv|u:p|users|12|nabad_production/);
  }
  assert.match(classifyToolError(""), /tool failed/);
});

test("finds the first failed step from the steps context", () => {
  const steps = { prepare: { outcome: "success" }, dump: { outcome: "success" }, "restore-check": { outcome: "failure" }, encrypt: { outcome: "skipped" } };
  assert.equal(firstFailedStep(JSON.stringify(steps)), "restore-check");
  assert.equal(firstFailedStep("{}"), "unknown");
  assert.equal(firstFailedStep("not json"), "unknown");
});
