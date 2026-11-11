const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { loadConfig } = require("./config");
const { clientIp } = require("./clientIp");
const {
  requestLogger,
  errorHandler,
} = require("./logger");

function createApp() {
  const config = loadConfig();

  const app = express();

  app.disable("x-powered-by");

  // Express never trusts X-Forwarded-For: a visitor can fake it through Vercel. The client IP that rate limits use
  // comes from clientIp.js instead (req.clientIp); see docs/environments.md, "Client IP".
  app.set("trust proxy", false);

  app.use(requestLogger);

  app.use(clientIp({ secret: config.proxySecret, required: config.proxyRequired, hosted: config.secure }));

  // Checks the client-IP setup without reading logs (docs/environments.md, "Client IP"). Staging and local: the
  // caller's own IP as the API resolved it. Production: only whether the request came through our proxy with the
  // right secret, never an address, so the secrets can be checked before API_PROXY_REQUIRED is turned on.
  app.get("/api/health/client-ip", (req, res) => res.json(config.environment === "production"
    ? { viaAppProxy: req.viaAppProxy }
    : { clientIp: req.clientIp, viaAppProxy: req.viaAppProxy }));

  app.use((req, res, next) => {
    res.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );

    res.setHeader(
      "Referrer-Policy",
      "no-referrer"
    );

    res.setHeader(
      "X-Frame-Options",
      "DENY"
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    next();
  });

  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true,
    })
  );

  app.use((req, res, next) => {
    if (
      ![
        "GET",
        "HEAD",
        "OPTIONS",
      ].includes(req.method) &&
      !config.isAllowedOrigin(
        req.get("Origin")
      )
    ) {
      return res.status(403).json({
        error:
          "Origin is not allowed.",
      });
    }

    next();
  });

  // Profile pictures (up to 1 MB as a data URL)
  // need a bigger body.
  app.use(
    [
      "/api/profile/me/picture",
      "/api/profile/linked/:id/picture",
    ],
    express.json({
      limit: "1500kb",
    })
  );

  app.use(cookieParser());

  // Route-local parsing keeps report uploads larger than ordinary API JSON while parsing only
  // after the report router has authenticated the caller.
  app.use("/api/reports", require("./routes/reports"));
  // Medical documents are sent as base64 JSON and need the same route-local body parsing
  // so the ordinary 100 KB API limit below does not reject uploads before their route runs.
  app.use("/api/medical-documents", require("./routes/medicalDocuments"));
  app.use("/api/emergency-card", require("./routes/emergencyCard"));
  app.use("/api/visit-prep", require("./routes/visitPrep"));
  app.use("/api/visit-prep-shares", require("./routes/visitPrepShares"));
  // SCRUM-146: a prescription photo, read into the medication list.
  app.use("/api/prescriptions", require("./routes/prescriptions"));

  app.use(
    express.json({
      limit: "100kb",
    })
  );

  app.use("/api/search", require("./routes/search"));

  // SCRUM-311: the team's usage dashboard (anonymous daily totals, team members only).
  app.use("/api/usage", require("./routes/usage"));

  app.use(
    "/api/health",
    require("./routes/health")
  );

  app.use(
    "/api/auth",
    require("./routes/auth")
  );

  app.use(
    "/api/account",
    require("./routes/account")
  );

  app.use(
    "/api/profile/emergency-contact",
    require("./routes/emergencyContact")
  );

  app.use(
    "/api/profile",
    require("./routes/profile")
  );

  app.use(
    "/api/medications",
    require("./routes/medications")
  );

  app.use(
    "/api/appointments",
    require("./routes/appointments")
  );

  app.use(
    "/api/symptoms",
    require("./routes/symptoms")
  );

  app.use(
    "/api/wellbeing",
    require("./routes/wellbeing")
  );

  app.use(
    "/api/health-profile",
    require("./routes/healthProfile")
  );

  app.use(
    "/api/vitals",
    require("./routes/vitals")
  );

  app.use(
    "/api/triage",
    require("./routes/triage")
  );

  app.use(
    "/api/notifications",
    require("./routes/notifications")
  );

  app.use(
    "/api/care-circle",
    require("./routes/careCircle")
  );

  app.use(
    "/api/providers",
    require("./routes/providers")
  );

  app.use((req, res) =>
    res.status(404).json({
      error: "Route not found.",
    })
  );

  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
