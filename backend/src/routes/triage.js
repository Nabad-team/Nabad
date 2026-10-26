// Urgency classification endpoints (SCRUM-128) and follow-up questions (SCRUM-126).
//
// POST /api/triage/classify  { symptoms }           -> first result + followUpQuestions
// POST /api/triage/refine    { symptoms, answers }  -> final result after the answers
//
// POST /api/triage/ai-assess { symptoms, answers?, followUpState?, location? } -> AI triage (SCRUM-180)
//   SCRUM-280: follow-up questions come one round at a time, at most 3. Send back every answer so far and
//   the result's followUpState; the next result has the next question, or none when it is done.
//
// Every result has "careTypeId" (SCRUM-278): a fixed id for the kind of care, which the
// "Find care" link turns into provider-directory filters. See triage/careTypes.js.
//
// The Sprint 1 safety check (POST /assess and /emergency-route, with its own rules in policy.js)
// is retired: it could give the same symptoms a different level. Its emergency routing and
// self-care now live in triage/careGuidance.js and come with the /ai-assess result.
//
// All require a signed-in user. The server is stateless: /refine classifies the symptoms
// again itself instead of trusting a level sent by the browser.
// SCRUM-279: /ai-assess reads the person's My health profile (the active profile: the user's own or a linked
// one), so the rules count its risk factors, the questions skip what it already says, and the AI gets its summary.
//
// All three urgency results include "explanation": why this was recommended, in plain language (SCRUM-130).

const express = require("express");
const rateLimit = require("express-rate-limit");

const {
  requireAuth,
} = require("../middleware/authMiddleware");

const { resolveProfile } = require("../middleware/profileAccess");
const SymptomRecord = require("../models/SymptomRecord");

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
  chooseCareTypeId,
} = require("../triage/careTypes");

const {
  getLlmClient,
} = require("../triage/ai/llmClient");

const {
  assessWithAi,
} = require("../triage/ai/aiTriage");

const {
  explainUrgency,
} = require("../triage/explanation");

const {
  alertCareCircleInBackground,
} = require("../careCircle");

const {
  loadHealthProfile,
} = require("../healthProfile");

const {
  readHealth,
} = require("../triage/healthContext");


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


// SCRUM-279: the person's My health profile for triage, or null. A symptom check must never fail because of it:
// if it can't be loaded, triage goes on without it, and the log says so (never with any health data).
async function healthForTriage(req) {
  try {
    return readHealth(await loadHealthProfile(req.userId, req.profileId));
  } catch {
    logEvent("triage_health_profile_unavailable", { requestId: req.requestId });
    return null;
  }
}


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

      // SCRUM-278: which kind of care, as a fixed id for the "Find care" link.
      careTypeId:
        chooseCareTypeId({
          level: result.level,
          symptoms,
        }),

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

        // SCRUM-278: chosen for the level after the answers.
        careTypeId:
          chooseCareTypeId({
            level: result.level,
            symptoms,
          }),

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
  resolveProfile,
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
      const [previousChecks, health] = await Promise.all([
        SymptomRecord.find({
          owner: req.userId,
          profileId: req.profileId,
        }).sort({ createdAt: -1 }).limit(3).lean(),
        healthForTriage(req),
      ]);
      const priorConversations = previousChecks.reverse().map((record) => ({
        symptoms: record.description,
        messages: (record.conversation || []).slice(-6).map(({ role, content }) => ({ role, content })),
      }));

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

            priorConversations,

            health,

            followUpState:
              req.body?.followUpState,
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

          // SCRUM-281: true when the AI found an emergency the rules missed (a possible
          // missing rule). Only this yes/no is logged, never what the user wrote.
          ruleGap:
            result.ai.ruleGap || undefined,

          // SCRUM-279: whether My health was used and made it more urgent. Yes/no only, never the facts.
          healthProfile:
            health ? "used" : "none",

          healthRaised:
            result.healthProfile.raisedBy.length > 0 || undefined,

          // SCRUM-280: why these follow-up questions (e.g. "model_pick", "model_confident"). Never the answers.
          followUp:
            result.followUpState.decision,

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


      res.json({
        ...result,

        explanation,

        selfCareGuidance,

        disclaimer:
          DISCLAIMER,
      });


      // The one place care circle alerts start (careCircle.js): urgent and emergency results tell
      // the user's care circle, once per check (checkId is the same for a check and its
      // follow-up answers). After the response, so the result is never delayed, and only
      // the level goes in: never the symptoms or answers.
      return alertCareCircleInBackground({
        requestId:
          req.requestId,

        owner:
          req.userId,

        profileId:
          req.profileId,

        level:
          result.level,

        checkId:
          req.body?.checkId,
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
