const express = require("express");
const rateLimit = require("../rateLimit");
const { requireAuth } = require("../middleware/authMiddleware");
const { resolveProfile } = require("../middleware/profileAccess");
const Medication = require("../models/Medication");
const MedicalDocument = require("../models/MedicalDocument");
const Appointment = require("../models/Appointment");
const Provider = require("../models/Provider");
const pages = require("../searchPages");
const router = express.Router();
const LIMIT = 6;
const limiter = rateLimit({ windowMs: 60000, max: 60, keyGenerator: req => req.userId,
  message: { error: "Too many searches. Please wait a minute and try again." } });
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matchFields = (words, fields) => ({ $and: words.map(word => ({ $or: fields.map(field => ({ [field]: new RegExp(escape(word), "i") })) })) });
const bucket = (items, map = value => value) => ({ items: items.slice(0, LIMIT).map(map), hasMore: items.length > LIMIT });

// POST keeps potentially private search text out of URLs, referrers and browser history.
// Nothing is stored; the existing logger records only the route pattern.
router.post("/", requireAuth, limiter, resolveProfile, async (req, res, next) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => key !== "q") ||
      typeof body.q !== "string" || body.q.length > 80) {
    return res.status(400).json({ error: "Enter a search between 2 and 80 characters." });
  }
  const q = body.q.normalize("NFC").trim().replace(/\s+/g, " ");
  if (q.length < 2 || /[\u0000-\u001f\u007f]/.test(q)) return res.status(400).json({ error: "Enter a search between 2 and 80 characters." });
  const words = q.split(" ");
  const scoped = { owner: req.userId, profileId: req.profileId };
  const find = (Model, scope, fields, select, sort) => Model.find({ ...scope, ...matchFields(words, fields) })
    .select(select).sort(sort).limit(LIMIT + 1).maxTimeMS(2000).lean();
  try {
    const [medications, documents, appointments, hospitals] = await Promise.all([
      find(Medication, scoped, ["name"], "name status", { name: 1, _id: 1 }),
      find(MedicalDocument, scoped, ["filename", "documentType"], "filename documentType", { createdAt: -1, _id: -1 }),
      find(Appointment, scoped, ["title", "hospital", "location"], "title hospital appointmentDate appointmentTime", { appointmentDate: 1, appointmentTime: 1, _id: 1 }),
      find(Provider, { type: "hospital" }, ["name", "city", "district", "specialties", "services"], "name slug city", { name: 1, slug: 1 }),
    ]);
    return res.json({
      pages: bucket(pages.filter(([label, , keywords]) => words.every(word => `${label} ${keywords}`.toLowerCase().includes(word.toLowerCase())))
        .map(([label, href]) => ({ label, href }))),
      medications: bucket(medications, m => ({ label: m.name, detail: m.status === "discontinued" ? "Discontinued" : "Active", href: `/medications#medication-${m._id}` })),
      documents: bucket(documents, d => ({ label: d.filename, detail: d.documentType, href: `/medical-documents#document-${d._id}` })),
      appointments: bucket(appointments, a => ({ label: a.title, detail: `${a.appointmentDate} ${a.appointmentTime} · ${a.hospital}`, href: `/appointments#appointment-${a._id}` })),
      hospitals: bucket(hospitals, h => ({ label: h.name, detail: h.city, href: `/providers/${encodeURIComponent(h.slug)}` })),
    });
  } catch (error) { return next(error); }
});
module.exports = router;
