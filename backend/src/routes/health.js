const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
// Preserve existing liveness. Deployment probes should use /ready.
router.get("/", (req, res) => res.json({ status: "ok" }));
router.get("/ready", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ status: "unavailable" });
    await mongoose.connection.db.command({ ping: 1 }, { timeoutMS: 1500 });
    return res.json({ status: "ready" });
  } catch { return res.status(503).json({ status: "unavailable" }); }
});
module.exports = router;
