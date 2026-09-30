const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { loadConfig } = require("./config");
const { requestLogger, errorHandler } = require("./logger");
function createApp() {
  const config = loadConfig();
  const app = express();
  app.disable("x-powered-by");
  // Number of proxies in front of the app (Vercel rewrite + Render = 2), so rate limits see the visitor's IP.
  if (config.trustProxy) app.set("trust proxy", config.trustProxy);
  app.use(requestLogger);
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use((req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("Origin") !== config.clientOrigin) {
      return res.status(403).json({ error: "Origin is not allowed." });
    }
    next();
  });
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use("/api/health", require("./routes/health"));
  app.use("/api/auth", require("./routes/auth"));
  app.use("/api/profile/emergency-contact", require("./routes/emergencyContact"));
  app.use((req, res) => res.status(404).json({ error: "Route not found." }));
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
