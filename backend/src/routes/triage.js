// Urgency classification endpoints (SCRUM-128) and follow-up questions (SCRUM-126).
//
// POST /api/triage/classify  { symptoms }           -> first result + followUpQuestions
// POST /api/triage/refine    { symptoms, answers }  -> final result after the answers
//
// POST /api/triage/ai-assess { symptoms, answers?, location? } -> AI triage (SCRUM-180)
//
// The Sprint 1 safety check (POST /assess and /emergency-route, with its own rules in policy.js)
// is retired: it could give the same symptoms a different level. Its emergency routing and
// self-care now live in triage/careGuidance.js and come with the /ai-assess result.
//
// All require a signed-in user. The server is stateless: /refine classifies the symptoms
// again itself instead of trusting a level sent by the browser.
// All three urgency results include "explanation": why this was recommended, in plain language (SCRUM-130).

const express = require("express");
const rateLimit = require("express-rate-limit");

const {
  requireAuth,
} = require("../middleware/authMiddleware");

const {
  logEvent,
} = require("../logger");

const {
  classifyUrgency,
} = require("../triage/urgency");

const {
  getFollowUpQuestions,
  refineUrgency,
  AnswerError,
} = require("../triage/followUps");

const {
  routineSelfCare,
} = require("../triage/careGuidance");

const {
  getLlmClient,
} = require("../triage/ai/llmClient");

const {
  assessWithAi,
} = require("../triage/ai/aiTriage");

const {
  explainUrgency,
} = require("../triage/explanation");


const router = express.Router();

router.use(requireAuth);


// Per account: each AI assessment is a paid call to the model provider.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  max: 30,

  keyGenerator: (req) =>
    req.userId,

  message: {
    error:
      "Too many symptom checks in a short time. Please wait a few minutes and try again. If this is an emergency, call 140 now.",
  },
});




const DISCLAIMER =
  "This is guidance, not a diagnosis. If you think it is an emergency, call 140 now.";


// Returns an error message, or null if the symptom text is acceptable.
function symptomsError(
  symptoms
) {
  if (
    typeof symptoms !== "string" ||
    symptoms.trim().length < 3
  ) {
    return "Please describe your symptoms before asking for an urgency level.";
  }

  if (symptoms.length > 2000) {
    return "Please keep the symptom description under 2000 characters.";
  }

  return null;
}


router.post(
  "/classify",
  (req, res) => {
    const symptoms =
      req.body?.symptoms;

    const error =
      symptomsError(
        symptoms
      );

    if (error) {
      return res
        .status(400)
        .json({ error });
    }

    const result =
      classifyUrgency(
        symptoms
      );

    return res.json({
      ...result,

      followUpQuestions:
        getFollowUpQuestions(
          symptoms,
          result
        ),

      explanation:
        explainUrgency({
          symptoms,
          result,
        }),

      disclaimer:
        DISCLAIMER,
    });
  }
);


router.post(
  "/refine",
  (req, res) => {
    const symptoms =
      req.body?.symptoms;

    const error =
      symptomsError(
        symptoms
      );

    if (error) {
      return res
        .status(400)
        .json({ error });
    }

    try {
      const answers =
        req.body?.answers;

      const result =
        refineUrgency(
          symptoms,
          answers
        );

      return res.json({
        ...result,

        explanation:
          explainUrgency({
            symptoms,
            result,
            answers,
          }),

        disclaimer:
          DISCLAIMER,
      });
    } catch (err) {
      if (
        err instanceof
        AnswerError
      ) {
        return res
          .status(400)
          .json({
            error:
              err.message,
          });
      }

      throw err;
    }
  }
);


router.post(
  "/ai-assess",
  aiLimiter,
  async (
    req,
    res,
    next
  ) => {
    const symptoms =
      req.body?.symptoms;

    const error =
      symptomsError(
        symptoms
      );

    if (error) {
      return res
        .status(400)
        .json({ error });
    }

    const started =
      performance.now();

    try {
      const result =
        await assessWithAi(
          symptoms,
          {
            client:
              getLlmClient(),

            answers:
              req.body?.answers,

            location:
              req.body?.location,
          }
        );


      // Only the outcome is logged,
      // never symptoms or model health text.
      logEvent(
        "triage_ai",
        {
          requestId:
            req.requestId,

          reason:
            result.ai.used
              ? `used:${result.ai.guardrails[0]}`
              : result.ai.reason,

          durationMs:
            Math.round(
              performance.now() -
                started
            ),
        }
      );


      const explanation =
        explainUrgency({
          symptoms,
          result,
          answers:
            req.body?.answers,
        });


      // Reuse the existing approved
      // self-care guidance for routine results.
      const selfCareGuidance =
        result.level === "routine"
          ? routineSelfCare()
          : [];


      return res.json({
        ...result,

        explanation,

        selfCareGuidance,

        disclaimer:
          DISCLAIMER,
      });
    } catch (err) {
      if (
        err instanceof
        AnswerError
      ) {
        return res
          .status(400)
          .json({
            error:
              err.message,
          });
      }

      return next(err);
    }
  }
);


module.exports = router;