export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_PATTERN = String.raw`(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\s]).{12,}`;
export const PASSWORD_HELP = "Use at least 12 characters with an uppercase letter, a lowercase letter, a number, and a symbol. Maximum 72 UTF-8 bytes.";