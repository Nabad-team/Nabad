// Creates (or resets) the JMeter test accounts in the LOCAL Docker MongoDB and writes users.csv for the test plan.
// Each account: verified email, onboarding done, 2FA OFF (only these load-test accounts), no medications left
// over from an earlier run. The password is random per seed and only stored in users.csv (git-ignored).
// Usage (from the repo root, with the Docker stack running):
//   node loadtest/jmeter/seed-users.js [count]      default 500
//   node loadtest/jmeter/seed-users.js --remove     deletes the load-test accounts and their data again
// Refuses any database that isn't on this machine.
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const backend = path.join(__dirname, "..", "..", "backend");
const fromBackend = (name) => require(require.resolve(name, { paths: [backend] }));
const mongoose = fromBackend("mongoose");

const MONGO_URI = process.env.LOADTEST_MONGO_URI || "mongodb://127.0.0.1:27018";
const DB_NAME = process.env.LOADTEST_DB_NAME || "nabad_development";
const DOMAIN = "loadtest.nabad.local"; // .local never routes on the internet: no email can reach a real person
const CSV = path.join(__dirname, "users.csv");

const host = new URL(MONGO_URI).hostname;
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  console.error(`Refusing to seed ${host}: load-test accounts are only created in the local Docker database.`);
  process.exit(1);
}

(async () => {
  const remove = process.argv.includes("--remove");
  const count = Number(process.argv.find((arg) => /^\d+$/.test(arg)) || 500);
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME, serverSelectionTimeoutMS: 5000 });
  const User = require(path.join(backend, "src", "models", "User"));
  const { hashPassword } = require(path.join(backend, "src", "passwordHashing"));
  const loadTestUsers = { email: new RegExp(`@${DOMAIN.replace(/\./g, "\\.")}$`) };

  // Data the test plan writes (medications) and anything else owned by these accounts.
  const ids = (await User.find(loadTestUsers).select("_id")).map((user) => user._id);
  const owned = ["medications", "wellbeings", "healthfacts", "symptomrecords", "appointments", "linkedprofiles"];
  for (const name of owned) await mongoose.connection.db.collection(name).deleteMany({ owner: { $in: ids } });

  if (remove) {
    const { deletedCount } = await User.deleteMany(loadTestUsers);
    fs.rmSync(CSV, { force: true });
    console.log(`Removed ${deletedCount} load-test accounts and their data from ${DB_NAME}.`);
    return mongoose.disconnect();
  }

  // One password for all: hashing 500 different ones would only slow the seed down, and each account is
  // still used by exactly one virtual user. It passes the password policy, though seeding doesn't need it to.
  const password = `Lt-${crypto.randomBytes(12).toString("base64url")}-9q!`;
  const passwordHash = await hashPassword(password);
  const lines = ["email,password"];
  const ops = [];
  for (let i = 1; i <= count; i += 1) {
    const email = `loadtest-${String(i).padStart(3, "0")}@${DOMAIN}`;
    lines.push(`${email},${password}`);
    ops.push({
      updateOne: {
        filter: { email },
        update: {
          $set: {
            name: `Load Test ${i}`, passwordHash, authProvider: "password", emailVerified: true, onboardingCompleted: true,
            twoFactorEnabled: false, failedLoginAttempts: 0, lockUntil: null, trustedDevices: [],
          },
          $setOnInsert: { email },
        },
        upsert: true,
      },
    });
  }
  await User.bulkWrite(ops);
  fs.writeFileSync(CSV, lines.join("\n") + "\n");
  console.log(`Seeded ${count} load-test accounts (2FA off) in ${DB_NAME}; credentials in ${path.relative(process.cwd(), CSV)}.`);
  await mongoose.disconnect();
})().catch((error) => { console.error(error); process.exit(1); });
