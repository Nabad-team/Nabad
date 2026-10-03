const PASSWORD_POLICY_ERROR = "Password must be at least 12 characters and include an uppercase letter, a lowercase letter, a number, and a symbol. It must be no more than 72 UTF-8 bytes.";

function meetsPasswordPolicy(password) {
  return typeof password === "string" &&
    Array.from(password).length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9\s]/.test(password) &&
    Buffer.byteLength(password, "utf8") <= 72;
}

module.exports = { meetsPasswordPolicy, PASSWORD_POLICY_ERROR };