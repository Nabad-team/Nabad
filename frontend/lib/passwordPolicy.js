export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_PATTERN = String.raw`(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\s]).{12,}`;
export const PASSWORD_HELP = "Use at least 12 characters with an uppercase letter, a lowercase letter, a number, and a symbol. Maximum 72 UTF-8 bytes.";

function utf8ByteLength(value) {
	return Array.from(value).reduce((length, character) => {
		const codePoint = character.codePointAt(0);
		return length + (codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4);
	}, 0);
}

export function getPasswordStrength(password) {
	if (!password) return null;

	const withinByteLimit = utf8ByteLength(password) <= 72;
	if (!withinByteLimit) return { label: "Weak", score: 1, color: "#b42318", detail: "Password exceeds the 72-byte limit." };

	const checks = [
		password.length >= PASSWORD_MIN_LENGTH,
		/[a-z]/.test(password),
		/[A-Z]/.test(password),
		/[0-9]/.test(password),
		/[^A-Za-z0-9\s]/.test(password),
	];
	const passed = checks.filter(Boolean).length;

	if (passed === checks.length) return { label: "Strong", score: 5, color: "#067647", detail: "Meets the password requirements." };
	if (checks[0] && passed >= 3) return { label: "Normal", score: 3, color: "#b54708", detail: "Add the remaining required character types to make it strong." };
	return { label: "Weak", score: 1, color: "#b42318", detail: "Add length and character variety to make it stronger." };
}