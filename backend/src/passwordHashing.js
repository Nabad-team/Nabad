const crypto = require("crypto");
const argon2 = require("@node-rs/argon2");
const bcrypt = require("@node-rs/bcrypt");
const User = require("./models/User");

// Password hashing. New passwords: Argon2id with OWASP's recommended parameters (Password Storage Cheat Sheet),
// set here and nowhere else. Older accounts still have a bcrypt hash (from bcryptjs, cost 12); it is checked
// once more at their next successful sign-in and replaced with Argon2id, with no action from the user.
// Both libraries are native with prebuilt binaries and hash on a background thread pool, not on Node's main thread.
// Passwords and hashes are never logged.

const ARGON2 = Object.freeze({
  algorithm: 2, // Argon2id (Algorithm.Argon2id; the package's enum doesn't exist at runtime)
  memoryCost: 19456, // 19 MiB, in KiB
  timeCost: 2,
  parallelism: 1,
});
const ARGON2_VERSION = 19;
// The cost of the bcrypt hashes stored before Argon2id. The timing dummy below uses the same cost.
const BCRYPT_COST = 12;
// bcrypt reads only the first 72 bytes of a password: a longer one must never match an old hash on its first 72 alone.
const BCRYPT_MAX_BYTES = 72;

// The same password typed on different devices can arrive in different Unicode forms (an accented letter as one
// character or as a letter plus an accent, Arabic presentation forms). NFKC turns them into one form.
const normalizePassword = (password) => password.normalize("NFKC");

const isBcryptHash = (hash) => typeof hash === "string" && /^\$2[aby]\$\d{2}\$/.test(hash);
const isArgon2Hash = (hash) => typeof hash === "string" && hash.startsWith("$argon2");

function hashPassword(password) {
  return argon2.hash(normalizePassword(password), ARGON2);
}

// True when an Argon2 hash wasn't made with the current settings (another variant, version or parameters).
function argon2NeedsRehash(hash) {
  const match = /^\$(argon2(?:id|i|d))\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(hash);
  if (!match) return true;
  const [, variant, version, memoryCost, timeCost, parallelism] = match;
  return variant !== "argon2id" || Number(version) !== ARGON2_VERSION || Number(memoryCost) !== ARGON2.memoryCost
    || Number(timeCost) !== ARGON2.timeCost || Number(parallelism) !== ARGON2.parallelism;
}

// Library errors (a malformed hash, for example) count as "doesn't match".
const bcryptMatches = (password, hash) => bcrypt.verify(password, hash).catch(() => false);
const argon2Matches = (hash, password) => argon2.verify(hash, password).catch(() => false);

// Hashes of a random secret, made once per process: checked against when an account has no hash of that kind,
// so every sign-in does the same work.
let dummies = null;
function dummyHashes() {
  if (!dummies) {
    const secret = crypto.randomBytes(32).toString("hex");
    dummies = Promise.all([bcrypt.hash(secret, { cost: BCRYPT_COST }), argon2.hash(secret, ARGON2)])
      .then(([bcryptHash, argon2Hash]) => ({ bcrypt: bcryptHash, argon2: argon2Hash }));
    dummies.catch(() => { dummies = null; });
  }
  return dummies;
}

// Checks a password against a stored hash. Returns { ok, rehash }: rehash is a new Argon2id hash to store when the
// stored one is bcrypt or has outdated parameters (only when ok).
// Every call does one bcrypt-cost check and then one Argon2 operation, whatever the stored hash is (or when there
// is none, for an unknown email), so neither the answer nor the time it takes shows which kind an account has.
async function verifyPassword(storedHash, password) {
  const typed = typeof password === "string" ? password : "";
  const dummy = await dummyHashes();
  if (isBcryptHash(storedHash)) {
    // As typed, exactly as bcryptjs checked it before: no normalization for old hashes.
    const matches = await bcryptMatches(typed, storedHash);
    if (!matches || Buffer.byteLength(typed, "utf8") > BCRYPT_MAX_BYTES) {
      await argon2Matches(dummy.argon2, typed);
      return { ok: false, rehash: null };
    }
    return { ok: true, rehash: await hashPassword(typed) };
  }
  await bcryptMatches(typed, dummy.bcrypt);
  if (!isArgon2Hash(storedHash)) {
    await argon2Matches(dummy.argon2, typed);
    return { ok: false, rehash: null };
  }
  const ok = await argon2Matches(storedHash, normalizePassword(typed));
  return { ok, rehash: ok && argon2NeedsRehash(storedHash) ? await hashPassword(typed) : null };
}

// verifyPassword for a user, saving the upgraded hash after a successful check. The update only applies if the hash
// is still the one that was checked, so it can never undo a password reset made at the same moment.
async function checkUserPassword(user, password) {
  const { ok, rehash } = await verifyPassword(user?.passwordHash, password);
  if (ok && rehash) await User.updateOne({ _id: user._id, passwordHash: user.passwordHash }, { $set: { passwordHash: rehash } });
  return ok;
}

module.exports = {
  ARGON2, BCRYPT_COST, BCRYPT_MAX_BYTES,
  normalizePassword, hashPassword, verifyPassword, checkUserPassword, argon2NeedsRehash, isBcryptHash, isArgon2Hash, dummyHashes,
};
