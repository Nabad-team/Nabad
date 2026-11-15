const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("../rateLimit");
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile } = require("../middleware/profileAccess");
const ProfileCoverage = require("../models/ProfileCoverage");

const router = express.Router();
router.use(requireAuth);

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const DOCUMENT_FIELDS = { patient_id: "patientId", insurance_card: "insuranceCard", nssf: "nssfDocument" };
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, keyGenerator: (req) => req.userId, message: { error: "Too many profile document changes. Please wait a few minutes and try again." } });
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const documentView = (document) => document ? {
  filename: document.filename, mimeType: document.mimeType, size: document.size, uploadedAt: document.uploadedAt,
} : null;
const view = (coverage) => ({
  hasInsurance: coverage?.hasInsurance || false,
  hasNssf: coverage?.hasNssf || false,
  patientId: documentView(coverage?.patientId),
  insuranceCard: documentView(coverage?.insuranceCard),
  nssfDocument: documentView(coverage?.nssfDocument),
});

function parsedFile(file) {
  if (!file || typeof file !== "object" || typeof file.filename !== "string" || typeof file.mimeType !== "string" || typeof file.data !== "string") return { error: "Choose a PDF, JPG or PNG document." };
  const filename = file.filename.trim().replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 255);
  const mimeType = file.mimeType.toLowerCase();
  if (!filename || !ALLOWED_MIME_TYPES.includes(mimeType)) return { error: "Choose a PDF, JPG or PNG document." };
  if (file.data.length > 4 * Math.ceil(MAX_FILE_SIZE / 3) || file.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) return { error: "Choose a valid document up to 5 MB." };
  const data = Buffer.from(file.data, "base64");
  if (!data.length || data.length > MAX_FILE_SIZE || data.toString("base64") !== file.data) return { error: "Choose a valid document up to 5 MB." };
  return { document: { filename, mimeType, size: data.length, data, uploadedAt: new Date() } };
}

router.get("/", resolveProfile, asyncRoute(async (req, res) => {
  const coverage = await ProfileCoverage.findOne({ owner: req.userId, profileId: req.profileId }).lean();
  return res.json({ coverage: view(coverage) });
}));

router.patch("/", writeLimiter, express.json({ limit: "10kb" }), resolveProfile, asyncRoute(async (req, res) => {
  const { hasInsurance, hasNssf } = req.body || {};
  if (typeof hasInsurance !== "boolean" || typeof hasNssf !== "boolean") return res.status(400).json({ error: "Choose whether this patient has medical insurance and NSSF." });
  const coverage = await ProfileCoverage.findOneAndUpdate(
    { owner: req.userId, profileId: req.profileId },
    { $set: { hasInsurance, hasNssf }, $setOnInsert: { owner: req.userId, profileId: req.profileId } },
    { new: true, upsert: true, runValidators: true }
  );
  return res.json({ coverage: view(coverage) });
}));

router.put("/documents/:kind", writeLimiter, express.json({ limit: "7mb" }), resolveProfile, asyncRoute(async (req, res) => {
  const field = DOCUMENT_FIELDS[req.params.kind];
  if (!field) return res.status(404).json({ error: "Profile document type not found." });
  const { document, error } = parsedFile(req.body?.file);
  if (error) return res.status(400).json({ error });
  const set = { [field]: document };
  if (field === "insuranceCard") set.hasInsurance = true;
  if (field === "nssfDocument") set.hasNssf = true;
  const coverage = await ProfileCoverage.findOneAndUpdate(
    { owner: req.userId, profileId: req.profileId },
    { $set: set, $setOnInsert: { owner: req.userId, profileId: req.profileId } },
    { new: true, upsert: true, runValidators: true }
  );
  return res.json({ coverage: view(coverage) });
}));

router.delete("/documents/:kind", writeLimiter, resolveProfile, asyncRoute(async (req, res) => {
  const field = DOCUMENT_FIELDS[req.params.kind];
  if (!field) return res.status(404).json({ error: "Profile document type not found." });
  const coverage = await ProfileCoverage.findOneAndUpdate(
    { owner: req.userId, profileId: req.profileId }, { $set: { [field]: null } }, { new: true, runValidators: true }
  );
  if (!coverage) return res.status(404).json({ error: "Profile document not found." });
  return res.json({ coverage: view(coverage) });
}));

router.get("/documents/:kind/download", resolveProfile, asyncRoute(async (req, res) => {
  const field = DOCUMENT_FIELDS[req.params.kind];
  if (!field) return res.status(404).json({ error: "Profile document not found." });
  const coverage = await ProfileCoverage.findOne({ owner: req.userId, profileId: req.profileId });
  const document = coverage?.[field];
  if (!document) return res.status(404).json({ error: "Profile document not found." });
  res.set({ "Content-Type": document.mimeType, "Content-Length": String(document.size), "Content-Disposition": `attachment; filename="${document.filename.replace(/["\\\r\n]/g, "_")}"`, "X-Content-Type-Options": "nosniff" });
  return res.end(document.data);
}));

module.exports = router;
