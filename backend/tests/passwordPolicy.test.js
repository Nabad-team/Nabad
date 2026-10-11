const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { checkNewPassword, findPasswordProblem, isBreachedPassword, breachCheckEnabled, PASSWORD_MESSAGES, COMMON_PASSWORDS } = require("../src/passwordPolicy");
const { loadConfig } = require("../src/config");

const code = (password, context) => findPasswordProblem(password, context)?.code ?? null;
const person = { name: "Leen El Baba", email: "leen.elbaba25@example.test" };
// Captures the log lines the logger writes while fn runs; anything else (the test reporter) passes through.
async function captureStdout(fn) {
  const original = process.stdout.write, lines = [];
  process.stdout.write = function (chunk, ...rest) {
    if (String(chunk).startsWith('{"time"')) { lines.push(String(chunk)); return true; }
    return original.call(this, chunk, ...rest);
  };
  try { await fn(); } finally { process.stdout.write = original; }
  return lines.join("");
}
const sha1 = (value) => crypto.createHash("sha1").update(value, "utf8").digest("hex").toUpperCase();
const rangeResponse = (body, status = 200) => ({ ok: status === 200, status, text: async () => body });

test("accepts 12 or more characters of any kind, with no forced character mixes", () => {
  for (const password of ["correct horse battery", "all lowercase words", "ALLUPPERCASEWORDS", "123456789012345678", "my cat sleeps on the sofa", "🌙🌟🌙🌟 sunny sky ☀️"]) {
    assert.equal(code(password, person), null, password);
  }
});

test("counts characters after NFKC normalization, so Arabic and emoji count one per character", () => {
  assert.equal(code("قطتي تحب الشمس"), null); // 14 Arabic characters and spaces
  assert.equal(code("قطة تحب شمس"), "tooShort"); // 11
  assert.equal(code("ب".repeat(12)), null);
  assert.equal(code("😀".repeat(11)), "tooShort"); // 44 bytes but only 11 characters
  assert.equal(code("😀".repeat(12)), null);
  // "ﷺ" is one code point that NFKC expands to 18, so it is counted as 18 characters.
  assert.equal(code("ﷺ"), null);
  // A decomposed "é" (2 code points) is one character after normalization: 21 code points, 11 characters.
  assert.equal(code("é".repeat(10) + "x"), "tooShort");
  assert.equal(code("é".repeat(11) + "x"), null);
});

test("rejects passwords shorter than 12 characters, and missing passwords", () => {
  for (const password of ["", "elevenchars", "Short1!Aa", undefined, null, 123456789012]) assert.equal(code(password), "tooShort", String(password));
  assert.equal(code("twelve chars"), null);
});

test("rejects passwords over bcrypt's 72-byte limit instead of cutting them short", () => {
  assert.equal(code("a".repeat(72)), null);
  assert.equal(code("a".repeat(73)), "tooLong");
  assert.equal(code("ب".repeat(36)), null); // 2 bytes each
  assert.equal(code("ب".repeat(37)), "tooLong");
  assert.equal(code("😀".repeat(18)), null); // 4 bytes each
  assert.equal(code("😀".repeat(19)), "tooLong");
});

test("bundles at least 10,000 common passwords and blocks them ignoring case", () => {
  assert.ok(COMMON_PASSWORDS.size >= 10000, `only ${COMMON_PASSWORDS.size} entries`);
  for (const password of ["password1234", "PASSWORD1234", "Password1234", "qwerty123456", "1q2w3e4r5t6y", "123456789012"]) {
    assert.equal(code(password), "common", password);
  }
});

test("blocks the user's name, the name part of their email, and the word Nabad", () => {
  assert.equal(code("leen loves the sea", person), "hasName");
  assert.equal(code("my friend BABA rocks", person), "hasName");
  assert.equal(code("leen.elbaba25 is me", { email: person.email }), "hasEmail");
  assert.equal(code("my code is elbaba25", { name: "Sam Rivers", email: person.email }), "hasEmail");
  assert.equal(code("ELBABA quiet garden", { email: "elbaba@example.test" }), "hasEmail");
  assert.equal(code("I love my nabad app", person), "hasSiteName");
  assert.equal(code("NABAD is wonderful", {}), "hasSiteName");
  // Name and email pieces under 3 characters are too common in ordinary words to block.
  assert.equal(code("elderberry jam pie", person), null);
  assert.equal(code("joyful morning walk", { name: "Jo", email: "jo@example.test" }), null);
  // Arabic names are checked too.
  assert.equal(code("ليلى تحب البحر كثيرا", { name: "ليلى" }), "hasName");
});

test("gives a specific plain-language message for each problem", () => {
  const messages = Object.values(PASSWORD_MESSAGES);
  assert.equal(new Set(messages).size, messages.length);
  assert.equal(PASSWORD_MESSAGES.tooLong, "This password is too long. Please use a shorter one.");
  for (const message of messages) assert.doesNotMatch(message, /byte|utf|bcrypt|hash|unicode|account/i);
  assert.deepEqual(findPasswordProblem("short"), { code: "tooShort", message: PASSWORD_MESSAGES.tooShort });
});

test("breach check sends only the first 5 hash characters and matches the suffix locally", async () => {
  const password = "a perfectly ordinary sentence", digest = sha1(password);
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push({ url, options }); return rangeResponse(`0000000000000000000000000000000000A:3\r\n${digest.slice(5)}:12\r\n`); };
  assert.equal(await isBreachedPassword(password, { fetchImpl }), true);
  assert.equal(calls[0].url, "https://api.pwnedpasswords.com/range/" + digest.slice(0, 5));
  assert.equal(calls[0].options.headers["Add-Padding"], "true");
  assert.equal(calls[0].options.body, undefined);
  assert.ok(!JSON.stringify(calls).includes(digest.slice(5)) && !JSON.stringify(calls).includes(password));
  assert.equal(await isBreachedPassword("another fine sentence", { fetchImpl }), false);
});

test("breach check ignores padding lines with a count of 0", async () => {
  const password = "a perfectly ordinary sentence";
  assert.equal(await isBreachedPassword(password, { fetchImpl: async () => rangeResponse(`${sha1(password).slice(5)}:0\n`) }), false);
});

test("checkNewPassword rejects breached passwords with a clear message", async () => {
  const password = "a perfectly ordinary sentence";
  const fetchImpl = async () => rangeResponse(`${sha1(password).slice(5)}:40`);
  assert.deepEqual(await checkNewPassword(password, person, { breachCheck: true, fetchImpl }), { code: "breached", message: PASSWORD_MESSAGES.breached });
  assert.equal(await checkNewPassword("a different calm sentence", person, { breachCheck: true, fetchImpl }), null);
});

test("checkNewPassword skips the network for passwords that already fail a rule, and when the check is off", async () => {
  let called = 0;
  const fetchImpl = async () => { called++; return rangeResponse(""); };
  assert.equal((await checkNewPassword("password1234", person, { breachCheck: true, fetchImpl })).code, "common");
  assert.equal(await checkNewPassword("a perfectly ordinary sentence", person, { breachCheck: false, fetchImpl }), null);
  assert.equal(called, 0);
});

// A fetch that never answers on its own: it only ends when the request's signal aborts, like a server that hangs.
const hangingFetch = (url, { signal }) => new Promise((resolve, reject) => {
  if (signal.aborted) return reject(signal.reason);
  signal.addEventListener("abort", () => reject(signal.reason));
});
// Replaces AbortSignal.timeout with one that fires on the next turn of the event loop instead of after
// real seconds, and records the time limit the code asked for. Tests stay instant and can't be slowed by load.
function instantTimeouts(t) {
  const requested = [];
  t.mock.method(AbortSignal, "timeout", (ms) => {
    requested.push(ms);
    const controller = new AbortController();
    setImmediate(() => controller.abort(new DOMException("The operation timed out.", "TimeoutError")));
    return controller.signal;
  });
  return requested;
}

test("if Have I Been Pwned is down or slow the password is allowed and only the failure type is logged", async (t) => {
  const password = "a perfectly ordinary sentence", digest = sha1(password);
  const failures = [
    ["server error", async () => rangeResponse("", 503), /"errorCode":"HTTP_503"/],
    ["network error", async () => { throw new TypeError("fetch failed", { cause: Object.assign(new Error("getaddrinfo"), { code: "ENOTFOUND" }) }); }, /"errorCode":"ENOTFOUND"/],
    ["timeout", hangingFetch, /"errorType":"TimeoutError"/],
  ];
  for (const [label, fetchImpl, expected] of failures) {
    await t.test(label, async (st) => {
      let result;
      // A hanging server still ends the check (the result below could not arrive otherwise).
      const requested = instantTimeouts(st);
      const output = await captureStdout(async () => { result = await checkNewPassword(password, person, { breachCheck: true, fetchImpl, requestId: "req-1" }); });
      assert.equal(result, null);
      assert.deepEqual(requested, [2000]);
      assert.match(output, /"event":"breach_check_failed"/);
      assert.match(output, /"requestId":"req-1"/);
      assert.match(output, expected);
      for (const secret of [password, digest, digest.slice(0, 5), digest.slice(5), digest.toLowerCase().slice(0, 5)]) assert.ok(!output.includes(secret), "log leaked " + secret);
    });
  }
});

test("breach check uses a 2-second timeout", async (t) => {
  // The limit the code asks for is checked directly, instead of timing a real 2-second wait.
  const requested = instantTimeouts(t);
  await assert.rejects(isBreachedPassword("a perfectly ordinary sentence", { fetchImpl: hangingFetch }), { name: "TimeoutError" });
  assert.deepEqual(requested, [2000]);
});

test("breach check is on by default, off in tests, and PWNED_PASSWORDS_CHECK overrides both", () => {
  assert.equal(breachCheckEnabled({ APP_ENV: "production" }), true);
  assert.equal(breachCheckEnabled({}), true);
  assert.equal(breachCheckEnabled({ NODE_ENV: "test" }), false);
  assert.equal(breachCheckEnabled({ APP_ENV: "production", PWNED_PASSWORDS_CHECK: "off" }), false);
  assert.equal(breachCheckEnabled({ NODE_ENV: "test", PWNED_PASSWORDS_CHECK: "on" }), true);
  const base = { MONGO_URI: "mongodb://localhost:27017", JWT_SECRET: "x".repeat(32) };
  assert.throws(() => loadConfig({ ...base, PWNED_PASSWORDS_CHECK: "yes" }), /PWNED_PASSWORDS_CHECK/);
  assert.doesNotThrow(() => loadConfig({ ...base, PWNED_PASSWORDS_CHECK: "off" }));
});
