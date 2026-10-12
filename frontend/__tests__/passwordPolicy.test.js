/**
 * @jest-environment node
 */
// Keeps the browser's password rules identical to the server's (backend/src/passwordPolicy.js).
import fs from "fs";
import path from "path";
import { findPasswordProblem, getPasswordStrength, passwordChecklist, PASSWORD_HELP, PASSWORD_MESSAGES } from "../lib/passwordPolicy";
import { LONG_COMMON_PASSWORDS } from "../lib/commonPasswords";
import { HEAVY_COMPUTE_TIMEOUT } from "../test-utils/timeouts";

const backend = require("../../backend/src/passwordPolicy");
const { longCommonPasswords } = require("../scripts/generate-common-passwords");
const commonListText = fs.readFileSync(path.join(__dirname, "../../backend/data/common-passwords.txt"), "utf8");
const code = (problem) => problem?.code ?? null;

const contexts = [{}, { name: "Leen El Baba", email: "leen.elbaba25@example.test" }, { name: "ليلى", email: "layla@example.test" }, { name: "Jo", email: "jo@example.test" }];
const samples = [
  "", "short", "elevenchars", "twelve chars", "my cat sleeps on the sofa", "password1234", "PASSWORD1234", "Password1234!",
  "a".repeat(72), "a".repeat(73), "a".repeat(128), "a".repeat(129), "ب".repeat(128), "ب".repeat(129), "😀".repeat(11), "😀".repeat(12),
  "😀".repeat(128), "😀".repeat(129), "é".repeat(128), "ﷺ".repeat(7), "ﷺ".repeat(8), "a" + "́".repeat(600), "x".repeat(5000),
  "é".repeat(11) + "x", "ﷺ", "قطتي تحب الشمس", "ليلى تحب البحر كثيرا", "leen loves the sea", "elbaba25 is my code",
  "I love my nabad app", "NABAD is wonderful", "elderberry jam pie", "\uD800 lone surrogate here", "ＰＡＳＳＷＯＲＤ１２３４",
];

test("the generated common-password list matches the backend's bundled list", () => {
  expect(LONG_COMMON_PASSWORDS).toEqual(longCommonPasswords(commonListText));
  expect(LONG_COMMON_PASSWORDS).toContain("password1234");
});

test("browser and server reach the same result for sample passwords", () => {
  for (const context of contexts) {
    for (const password of samples) {
      expect([password, code(findPasswordProblem(password, context))]).toEqual([password, code(backend.findPasswordProblem(password, context))]);
    }
  }
});

test("browser and server agree on every common password, in its listed form and upper-cased", () => {
  const mismatches = [];
  for (const entry of commonListText.split(/\r?\n/).filter(Boolean)) {
    for (const password of [entry, entry.toUpperCase()]) {
      if (code(findPasswordProblem(password)) !== code(backend.findPasswordProblem(password))) mismatches.push(password);
    }
  }
  expect(mismatches).toEqual([]);
}, HEAVY_COMPUTE_TIMEOUT); // compares every entry of the common password list

test("messages are the server's, word for word", () => {
  const { breached, ...serverMessages } = backend.PASSWORD_MESSAGES;
  expect(PASSWORD_MESSAGES).toEqual(serverMessages);
  expect(breached).toBeDefined();
});

test("the too-long item appears in the checklist only once the password is over 128 characters", () => {
  const ids = (password) => passwordChecklist(password).map((item) => item.id);
  expect(ids("a".repeat(128))).toEqual(["length", "common"]);
  expect(ids("a".repeat(129))).toEqual(["length", "common", "maxLength"]);
  expect(passwordChecklist("a".repeat(129)).at(-1)).toEqual({ id: "maxLength", label: "No more than 128 characters", met: false });
  expect(ids("ﷺ".repeat(8))).toContain("maxLength"); // counted after NFKC, like the server
});

test("help text is plain and never mentions a maximum or technical terms", () => {
  expect(PASSWORD_HELP).toBe("Use at least 12 characters. A short sentence works great.");
  for (const text of [PASSWORD_HELP, ...Object.values(PASSWORD_MESSAGES), ...passwordChecklist("x", {}).map((item) => item.label)]) {
    expect(text).not.toMatch(/byte|utf|bcrypt|unicode|maximum|72|uppercase|symbol/i);
  }
});

test("strength is Weak until every rule passes, then grows with length", () => {
  expect(getPasswordStrength("")).toBeNull();
  expect(getPasswordStrength("Tr0ub4dor&3").label).toBe("Weak"); // mixed characters, but too short
  expect(getPasswordStrength("password1234").label).toBe("Weak"); // long enough, but common
  expect(getPasswordStrength("a".repeat(129)).label).toBe("Weak"); // over 128 characters
  expect(getPasswordStrength("quiet garden").label).toBe("Good");
  expect(getPasswordStrength("my cat sleeps on the sofa").label).toBe("Strong");
  expect(getPasswordStrength("leen loves the sea", { name: "Leen" }).label).toBe("Weak");
});
