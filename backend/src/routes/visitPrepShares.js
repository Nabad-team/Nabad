const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("../rateLimit");
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile, profileView } = require("../middleware/profileAccess");
const VisitPrepShare = require("../models/VisitPrepShare");
const MedicalDocument = require("../models/MedicalDocument");

const router = express.Router();
const run = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyGenerator: (req) => req.userId || req.ip, message: { error: "Too many requests. Please wait a few minutes and try again." } });
const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const iso = (value) => value ? new Date(value).toISOString() : null;

function ownerView(share) {
  return {
    id: String(share._id), profileId: profileView(share), patientName: share.patientName,
    createdAt: iso(share.createdAt), expiresAt: iso(share.expiresAt), revokedAt: iso(share.revokedAt),
    lastViewedAt: iso(share.lastViewedAt), viewCount: share.viewCount || 0,
    confirmedAt: iso(share.confirmedAt), confirmedBy: share.confirmedBy || "",
  };
}

function readSnapshot(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid share details." };
  const patientName = typeof body.patientName === "string" ? body.patientName.trim() : "";
  if (!patientName || patientName.length > 200) return { error: "Enter a valid patient name." };
  if (!Array.isArray(body.sections) || body.sections.length < 1 || body.sections.length > 10) return { error: "Include at least one valid visit-sheet section." };
  const sections = [];
  for (const section of body.sections) {
    const title = typeof section?.title === "string" ? section.title.trim() : "";
    const text = typeof section?.text === "string" ? section.text.trim() : "";
    if (!title || title.length > 120 || !text || text.length > 30000) return { error: "Include valid visit-sheet section titles and text." };
    sections.push({ title, text });
  }
  const expiresInDays = Number(body.expiresInDays);
  if (![1, 7, 30].includes(expiresInDays)) return { error: "Choose a link expiry of 1, 7 or 30 days." };
  const documentIds = body.documentIds === undefined ? [] : body.documentIds;
  if (!Array.isArray(documentIds) || documentIds.length > 50 || documentIds.some((id) => typeof id !== "string" || !mongoose.isValidObjectId(id))) return { error: "Choose valid visit documents." };
  return { value: { patientName, sections, expiresInDays, documentIds: [...new Set(documentIds)] } };
}

async function activeShare(token) {
  if (typeof token !== "string" || !tokenPattern.test(token)) return null;
  return VisitPrepShare.findOne({ tokenHash: hash(token) }).select("+tokenHash");
}

// Signed-in management endpoints. A link is shown only once, when it is created; only its hash is stored.
router.get("/", requireAuth, resolveProfile, run(async (req, res) => {
  const shares = await VisitPrepShare.find({ owner: req.userId, profileId: req.profileId }).sort({ createdAt: -1 }).limit(50).lean();
  return res.json({ shares: shares.map(ownerView) });
}));

router.post("/", requireAuth, writeLimiter, express.json({ limit: "350kb" }), resolveProfile, run(async (req, res) => {
  const { value, error } = readSnapshot(req.body);
  if (error) return res.status(400).json({ error });
  if (value.documentIds.length && await MedicalDocument.countDocuments({ owner: req.userId, profileId: req.profileId, _id: { $in: value.documentIds } }) !== value.documentIds.length) {
    return res.status(400).json({ error: "A selected document is no longer available. Reload the sheet and try again." });
  }
  const activeCount = await VisitPrepShare.countDocuments({ owner: req.userId, profileId: req.profileId, revokedAt: null, expiresAt: { $gt: new Date() } });
  if (activeCount >= 10) return res.status(400).json({ error: "This profile already has 10 active links. Revoke an old link before creating another." });
  const token = crypto.randomBytes(32).toString("base64url");
  const share = await VisitPrepShare.create({
    owner: req.userId, profileId: req.profileId, tokenHash: hash(token), patientName: value.patientName,
    sections: value.sections, documentIds: value.documentIds,
    expiresAt: new Date(Date.now() + value.expiresInDays * 24 * 60 * 60 * 1000),
  });
  return res.status(201).json({ share: ownerView(share), token });
}));

router.delete("/:id", requireAuth, writeLimiter, resolveProfile, run(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Shared link not found." });
  const share = await VisitPrepShare.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId, profileId: req.profileId },
    { $set: { revokedAt: new Date() } }, { new: true }
  );
  if (!share) return res.status(404).json({ error: "Shared link not found." });
  return res.json({ share: ownerView(share) });
}));

// Public endpoints reveal data only to possession of an active, high-entropy token.
router.get("/public/:token", publicLimiter, run(async (req, res) => {
  const share = await activeShare(req.params.token);
  if (!share) return res.status(404).json({ error: "This shared visit sheet is not available." });
  if (share.revokedAt) return res.status(410).json({ error: "This shared link has been revoked." });
  if (share.expiresAt <= new Date()) return res.status(410).json({ error: "This shared link has expired." });
  const documents = await MedicalDocument.find({ _id: { $in: share.documentIds }, owner: share.owner, profileId: share.profileId }).select("filename mimeType documentType documentDate size").lean();
  const now = new Date();
  await VisitPrepShare.updateOne({ _id: share._id }, { $set: { lastViewedAt: now }, $inc: { viewCount: 1 } });
  return res.json({ sheet: {
    patientName: share.patientName, sections: share.sections, createdAt: share.createdAt, expiresAt: share.expiresAt,
    confirmedAt: share.confirmedAt, confirmedBy: share.confirmedBy || "",
    documents: documents.map((document) => ({ id: String(document._id), filename: document.filename, mimeType: document.mimeType, documentType: document.documentType, documentDate: document.documentDate, size: document.size })),
  } });
}));

router.post("/public/:token/confirm", publicLimiter, express.json({ limit: "5kb" }), run(async (req, res) => {
  const clinicianName = typeof req.body?.clinicianName === "string" ? req.body.clinicianName.trim() : "";
  if (req.body?.accurate !== true || !clinicianName || clinicianName.length > 120) return res.status(400).json({ error: "Enter your name and confirm that the sheet is accurate." });
  if (typeof req.params.token !== "string" || !tokenPattern.test(req.params.token)) return res.status(404).json({ error: "This shared visit sheet is not available." });
  const share = await VisitPrepShare.findOneAndUpdate(
    { tokenHash: hash(req.params.token), revokedAt: null, expiresAt: { $gt: new Date() }, confirmedAt: null },
    { $set: { confirmedAt: new Date(), confirmedBy: clinicianName } }, { new: true }
  );
  if (!share) {
    const existing = await activeShare(req.params.token);
    if (!existing) return res.status(404).json({ error: "This shared visit sheet is not available." });
    if (existing.revokedAt) return res.status(410).json({ error: "This shared link has been revoked." });
    if (existing.expiresAt <= new Date()) return res.status(410).json({ error: "This shared link has expired." });
    if (existing.confirmedAt) return res.status(409).json({ error: "This visit sheet has already been confirmed." });
    return res.status(409).json({ error: "This visit sheet could not be confirmed." });
  }
  return res.json({ confirmedAt: share.confirmedAt, confirmedBy: share.confirmedBy });
}));

router.get("/public/:token/documents/:documentId", publicLimiter, run(async (req, res) => {
  const share = await activeShare(req.params.token);
  if (!share || share.revokedAt || share.expiresAt <= new Date() || !share.documentIds.some((id) => String(id) === req.params.documentId)) return res.status(404).json({ error: "Document not found." });
  const document = await MedicalDocument.findOne({ _id: req.params.documentId, owner: share.owner, profileId: share.profileId }).select("+data");
  if (!document) return res.status(404).json({ error: "Document not found." });
  res.set({ "Content-Type": document.mimeType, "Content-Length": String(document.size), "Content-Disposition": `attachment; filename="${document.filename.replace(/["\\\r\n]/g, "_")}"`, "X-Content-Type-Options": "nosniff" });
  return res.end(document.data);
}));

module.exports = router;
