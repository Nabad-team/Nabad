const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile } = require("../middleware/profileAccess");
const MedicalDocument = require("../models/MedicalDocument");

const router = express.Router();
router.use(requireAuth);

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
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
  if (!filename || !ALLOWED_TYPES.has(file.mimeType)) return res.status(400).json({ error: "Choose a PDF, JPG, PNG or WebP medical document to upload." });
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data)) return res.status(400).json({ error: "This file could not be read. Please choose it again." });
  const data = Buffer.from(file.data, "base64");
  if (!data.length || data.length > MAX_FILE_SIZE) return res.status(400).json({ error: "Each document must be smaller than 10 MB." });
  const signatures = {
    "application/pdf": data.subarray(0, 5).toString() === "%PDF-",
    "image/jpeg": data[0] === 0xff && data[1] === 0xd8 && data[data.length - 2] === 0xff && data[data.length - 1] === 0xd9,
    "image/png": data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/webp": data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP",
  };
  if (!signatures[file.mimeType]) return res.status(400).json({ error: "The file contents do not match the selected document type." });
  if (await MedicalDocument.countDocuments({ owner: req.userId, profileId: req.profileId }) >= 500) return res.status(400).json({ error: "This profile has reached its 500 document limit." });
  const document = await MedicalDocument.create({ owner: req.userId, profileId: req.profileId, filename, mimeType: file.mimeType, size: data.length, data });
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
