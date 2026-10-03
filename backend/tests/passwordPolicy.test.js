const { test } = require("node:test");
const assert = require("node:assert/strict");
const { meetsPasswordPolicy } = require("../src/passwordPolicy");

test("accepts a password that meets all strength requirements", () => {
  assert.equal(meetsPasswordPolicy("StrongPassword123!"), true);
});

test("rejects passwords that miss a length or character requirement", () => {
  for (const password of [
    "Short1!Aa",
    "lowercase123!",
    "UPPERCASE123!",
    "NoNumbersHere!",
    "NoSymbol12345",
  ]) {
    assert.equal(meetsPasswordPolicy(password), false, password);
  }
});

test("rejects passwords exceeding bcrypt's 72-byte limit", () => {
  assert.equal(meetsPasswordPolicy("A" + "a".repeat(70) + "1!"), false);
  assert.equal(meetsPasswordPolicy("Ä".repeat(36) + "Aa1!"), false);
});