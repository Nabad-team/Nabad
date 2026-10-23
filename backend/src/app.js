const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { loadConfig } = require("./config");
const {
  requestLogger,
  errorHandler,
} = require("./logger");

function createApp() {
  const config = loadConfig();

  const app = express();

  app.disable("x-powered-by");

  // Number of proxies in front of the app
  // (Vercel rewrite + Render = 2),
  // so rate limits see the visitor's IP.
  if (config.trustProxy) {
    app.set(
      "trust proxy",
      config.trustProxy
    );
  }

  app.use(requestLogger);

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
      req.get("Origin") !==
        config.clientOrigin
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

  app.use(
    express.json({
      limit: "100kb",
    })
  );

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
    "/api/medical-documents",
    require("./routes/medicalDocuments")
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
