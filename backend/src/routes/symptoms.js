const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const SymptomRecord = require("../models/SymptomRecord");
const { LEVELS } = require("../triage/urgency");
const URGENCY_LEVELS = new Set(["emergency", "urgent", "soon", "routine"]);
const { LIMITS } = SymptomRecord;

const {
  requireAuth,
} = require("../middleware/authMiddleware");

const {
  resolveProfile,
  profileView,
} = require("../middleware/profileAccess");

const asyncRoute =
  (handler) => (req, res, next) =>
    Promise.resolve(
      handler(req, res, next)
    ).catch(next);

// Symptom records for the signed-in user's own profile
// or one of their linked profiles.
//
// Every route uses ?profileId=
// "self" is the default.
//
// Another user's profile or record returns 404.
//
// IMPORTANT:
// Symptom descriptions are health data.
// They must never be written to application logs.

const router = express.Router();

router.use(requireAuth);

const MAX_RECORDS = 500;

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,

  keyGenerator: (req) => req.userId,

  message: {
    error:
      "Too many changes in a short time. Please wait a few minutes and try again.",
  },
});

router.use(resolveProfile);

const NOT_FOUND = {
  error: "Symptom record not found.",
};

function view(record) {
  return {
    id: String(record._id),

    profileId: profileView(record),

    description: record.description,

    urgencyResult: record.urgencyResult,

    createdAt: record.createdAt,

    updatedAt: record.updatedAt,
  };
}

function readSymptomRecord(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return {
      error: "Invalid request body.",
    };
  }

  if (
    typeof body.description !== "string"
  ) {
    return {
      error: "Symptom description must be text.",
    };
  }

  const description =
    body.description.trim();

  if (!description) {
    return {
      error: "Enter a symptom description.",
    };
  }

  if (
    description.length >
    LIMITS.description
  ) {
    return {
      error:
        `Symptom description must be ${LIMITS.description} characters or fewer.`,
    };
  }

  const urgencyResult =
    body.urgencyResult;
  const expectedLevel =
    urgencyResult && LEVELS[urgencyResult.level];

  if (
    !urgencyResult ||
    typeof urgencyResult !== "object" ||
    Array.isArray(urgencyResult) ||
    !URGENCY_LEVELS.has(urgencyResult.level) ||
    !expectedLevel ||
    ["label", "timeframe", "action"].some((field) =>
      typeof urgencyResult[field] !== "string" ||
      !urgencyResult[field].trim() ||
      urgencyResult[field] !== expectedLevel[field]
    )
  ) {
    return {
      error:
        "A valid urgency result is required.",
    };
  }

  return {
    record: {
      description,
      urgencyResult,
    },
  };
}

function ownedFilter(req) {
  if (
    !mongoose.isValidObjectId(
      req.params.id
    )
  ) {
    return null;
  }

  return {
    _id: req.params.id,
    owner: req.userId,
    profileId: req.profileId,
  };
}


// ----------------------------------------------------
// GET SYMPTOM RECORDS
// ----------------------------------------------------

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const records =
      await SymptomRecord.find({
        owner: req.userId,
        profileId: req.profileId,
      }).sort({
        createdAt: -1,
        _id: -1,
      });

    return res.json({
      symptomRecords:
        records.map(view),
    });
  })
);


// ----------------------------------------------------
// ADD SYMPTOM RECORD
// ----------------------------------------------------

router.post(
  "/",
  writeLimiter,
  asyncRoute(async (req, res) => {
    const {
      record,
      error,
    } = readSymptomRecord(req.body);

    if (error) {
      return res.status(400).json({
        error,
      });
    }

    const count =
      await SymptomRecord.countDocuments({
        owner: req.userId,
        profileId: req.profileId,
      });

    if (count >= MAX_RECORDS) {
      return res.status(400).json({
        error:
          `You can keep up to ${MAX_RECORDS} symptom records. Delete older records first.`,
      });
    }

    const created =
      await SymptomRecord.create({
        ...record,

        owner: req.userId,

        profileId: req.profileId,
      });

    return res.status(201).json({
      symptomRecord: view(created),
    });
  })
);


// ----------------------------------------------------
// DELETE SYMPTOM RECORD
// ----------------------------------------------------

router.delete(
  "/:id",
  writeLimiter,
  asyncRoute(async (req, res) => {
    const filter =
      ownedFilter(req);

    if (!filter) {
      return res
        .status(404)
        .json(NOT_FOUND);
    }

    const result =
      await SymptomRecord.deleteOne(
        filter
      );

    if (
      result.deletedCount === 0
    ) {
      return res
        .status(404)
        .json(NOT_FOUND);
    }

    return res
      .status(204)
      .end();
  })
);

module.exports = router;
