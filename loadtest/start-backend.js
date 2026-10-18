// Starts the backend for load testing, fully isolated from any real data:
// - its own throwaway MongoDB (mongodb-memory-server), database "nabad_loadtest", deleted on exit;
// - every setting passed explicitly, so values in backend/.env (real MONGO_URI, SMTP, ...) are never used;
// - rate limits relaxed in this process only (see below). backend/src is not changed.
// Usage (from the repo root): node loadtest/start-backend.js   -> http://localhost:5100
const path = require("path");
const crypto = require("crypto");
const backend = path.join(__dirname, "..", "backend");
const fromBackend = (name) => require(require.resolve(name, { paths: [backend] }));

// Relax rate limits before the backend loads: all k6 users share one IP (127.0.0.1), so the real
// per-IP limits would only measure 429 responses. Only this process is affected (see the file).
require("./relax-rate-limits");

const PORT = process.env.LOADTEST_PORT || "5100";

(async () => {
  process.env.MONGOMS_DOWNLOAD_DIR ||= path.join(backend, "node_modules", ".cache", "mongodb-memory-server");
  const { MongoMemoryServer } = fromBackend("mongodb-memory-server");
  const mongo = await MongoMemoryServer.create();
  // dotenv never overrides variables that are already set, even to "", so backend/.env cannot leak in.
  Object.assign(process.env, {
    NODE_ENV: "production", // Express production mode, as on Render
    APP_ENV: "development", // plain-HTTP cookies on localhost
    PORT,
    MONGO_URI: mongo.getUri(),
    MONGO_DB_NAME: "nabad_loadtest",
    JWT_SECRET: crypto.randomBytes(32).toString("hex"),
    CLIENT_ORIGIN: "http://localhost:3000",
    SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "", MAIL_FROM: "", EMAIL_FROM: "",
    GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", GOOGLE_REDIRECT_URI: "",
    // No calls to Have I Been Pwned: a load test must not send thousands of requests to an outside service,
    // and its network time would hide the server's own work.
    PWNED_PASSWORDS_CHECK: "off",
  });
  const server = await require(path.join(backend, "src", "server.js")).start();
  console.error(`Load-test backend on http://localhost:${PORT} (database nabad_loadtest, rate limits relaxed)`);
  const stop = async () => { server.close(); await mongo.stop(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
})().catch((error) => { console.error(error); process.exit(1); });
