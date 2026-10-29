const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
async function databaseReady(connection = mongoose.connection, timeoutMs = 1500) {
  if (connection.readyState !== 1 || !connection.db?.command) return false;
  let timer;
  try {
    return await Promise.race([
      connection.db.command({ ping: 1 }, { timeoutMS: timeoutMs }).then(() => true, () => false),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); }),
    ]);
  } catch { return false; }
  finally { clearTimeout(timer); }
}
// Preserve liveness separately from database readiness. No connection details leave this endpoint.
router.get("/", (req,res) => res.json({status:"ok"}));
router.get("/ready", async (req,res) => {
  const ready = await databaseReady();
  return res.status(ready ? 200 : 503).json({status: ready ? "ready" : "unavailable"});
});
module.exports = router;
module.exports.databaseReady = databaseReady;
