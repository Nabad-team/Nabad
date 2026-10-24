const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile } = require("../middleware/profileAccess");
const MedicalDocument = require("../models/MedicalDocument");

const router = express.Router();
router.use(requireAuth);

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyGenerator: (req) => req.userId, message: { error: "Too many uploads. Please wait a few minutes and try again." } });
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const view = (document) => ({ id: String(document._id), filename: document.filename, mimeType: document.mimeType, size: document.size, uploadedAt: document.createdAt });

router.get("/", resolveProfile, asyncRoute(async (req, res) => {
  const documents = await MedicalDocument.find({ owner: req.userId, profileId: req.profileId }).sort({ createdAt: -1 }).limit(500).lean();
  return res.json({ documents: documents.map(view) });
}));

router.post("/", uploadLimiter, express.json({ limit: "14mb" }), resolveProfile, asyncRoute(async (req, res) => {
  const file = req.body?.file;
  if (!file || typeof file !== "object" || typeof file.data !== "string" || typeof file.filename !== "string" || typeof file.mimeType !== "string") {
    return res.status(400).json({ error: "Choose a PDF, JPG, PNG or WebP medical document to upload." });
  }
  const filename = file.filename.trim().replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 255);
  if (!filename) return res.status(400).json({ error: "Choose a medical document to upload." });
  const mimeType = typeof file.mimeType === "string" && /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(file.mimeType)
    ? file.mimeType.toLowerCase() : "application/octet-stream";
  if (file.data.length > 4 * Math.ceil(MAX_FILE_SIZE / 3)) return res.status(413).json({ error: "Each document must be 10 MB or smaller." });
  if (file.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) return res.status(400).json({ error: "This file could not be read. Please choose it again." });
  const decodedSize = file.data.length * 3 / 4 - (file.data.endsWith("==") ? 2 : file.data.endsWith("=") ? 1 : 0);
  if (!decodedSize) return res.status(400).json({ error: "This file is empty. Choose a document with content." });
  if (decodedSize > MAX_FILE_SIZE) return res.status(413).json({ error: "Each document must be 10 MB or smaller." });
  const data = Buffer.from(file.data, "base64");
  if (!data.length || data.toString("base64") !== file.data) return res.status(400).json({ error: "This file could not be read. Please choose it again." });
  if (await MedicalDocument.countDocuments({ owner: req.userId, profileId: req.profileId }) >= 500) return res.status(400).json({ error: "This profile has reached its 500 document limit." });
  const document = await MedicalDocument.create({ owner: req.userId, profileId: req.profileId, filename, mimeType, size: data.length, data });
  return res.status(201).json({ document: view(document) });
}));

router.get("/:id/download", resolveProfile, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Document not found." });
  const document = await MedicalDocument.findOne({ _id: req.params.id, owner: req.userId, profileId: req.profileId }).select("+data");
  if (!document) return res.status(404).json({ error: "Document not found." });
  res.set({ "Content-Type": document.mimeType, "Content-Length": String(document.size), "Content-Disposition": `attachment; filename="${document.filename.replace(/["\\\r\n]/g, "_")}"`, "X-Content-Type-Options": "nosniff" });
  return res.end(document.data);
}));

module.exports = router;
