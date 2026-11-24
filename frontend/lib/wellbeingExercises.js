// The Wellbeing Corner's calm exercises (pages/wellbeing.js, components/wellbeing/). Pure data and timing, so they
// can be tested without a browser. Nothing here is stored or sent anywhere: no mood, no answers, no history.

import { beirutDayString } from "./dates";

// Guided breathing: in 4 s, hold 4 s, out 6 s (14 s a round). Nine rounds is 126 s, about two minutes.
export const BREATHING_PHASES = [
  { key: "in", label: "Breathe in", seconds: 4 },
  { key: "hold", label: "Hold", seconds: 4 },
  { key: "out", label: "Breathe out", seconds: 6 },
];
export const BREATHING_ROUND_SECONDS = BREATHING_PHASES.reduce((total, phase) => total + phase.seconds, 0);
export const BREATHING_ROUNDS = 9;
export const BREATHING_TOTAL_SECONDS = BREATHING_ROUND_SECONDS * BREATHING_ROUNDS;

// Where the exercise is after `elapsed` whole seconds of breathing (pauses don't count).
//   phase: the current step; secondsLeft: the countdown shown for it (4, 3, 2, 1); round: 1-based; done: finished.
export function breathingStateAt(elapsed) {
  const seconds = Math.max(0, Math.floor(elapsed));
  if (seconds >= BREATHING_TOTAL_SECONDS) {
    return { done: true, phase: null, phaseIndex: -1, secondsLeft: 0, round: BREATHING_ROUNDS, remaining: 0 };
  }
  const round = Math.floor(seconds / BREATHING_ROUND_SECONDS) + 1;
  let intoRound = seconds % BREATHING_ROUND_SECONDS;
  let phaseIndex = 0;
  while (intoRound >= BREATHING_PHASES[phaseIndex].seconds) {
    intoRound -= BREATHING_PHASES[phaseIndex].seconds;
    phaseIndex += 1;
  }
  const phase = BREATHING_PHASES[phaseIndex];
  return { done: false, phase, phaseIndex, secondsLeft: phase.seconds - intoRound, round, remaining: BREATHING_TOTAL_SECONDS - seconds };
}

// Grounding, "5, 4, 3, 2, 1": one step at a time, no typing.
export const GROUNDING_STEPS = [
  { count: 5, text: "Name 5 things you can see." },
  { count: 4, text: "Name 4 things you can feel." },
  { count: 3, text: "Name 3 things you can hear." },
  { count: 2, text: "Name 2 things you can smell." },
  { count: 1, text: "Name 1 thing you can taste." },
];

// The 5-minute reset: these three, in this order.
export const RESET_STEPS = [
  { key: "breathing", label: "Breathing" },
  { key: "grounding", label: "Grounding" },
  { key: "reflection", label: "Reflection" },
];
export function nextResetStep(key) {
  const index = RESET_STEPS.findIndex((step) => step.key === key);
  return index >= 0 && index < RESET_STEPS.length - 1 ? RESET_STEPS[index + 1].key : null;
}

// Reflection question of the day: shown only, never answered or saved.
export const REFLECTION_QUESTIONS = [
  "What's one small thing that went well today?",
  "What is something you are looking forward to, even a little?",
  "Who made your day a bit easier recently?",
  "What helped you feel calm at some point this week?",
  "What is one thing you did today that you're glad you did?",
  "What would a kind friend say to you right now?",
  "What is one thing you can let go of for today?",
  "Where in your day did you have a moment to rest?",
  "What is a sound, smell or taste you enjoyed recently?",
  "What is one thing you are grateful for today?",
  "What is something small that made you smile lately?",
  "What do you need most this evening?",
  "What is one way you took care of yourself today?",
  "Who would you like to check in with this week?",
  "What is a place where you feel at ease?",
  "What is one thing that felt a little lighter today?",
  "What did you learn about yourself this week?",
  "What is a simple thing you could enjoy tomorrow?",
  "What is something you handled better than you expected?",
  "What would make tomorrow a little easier?",
  "What is a memory that makes you feel warm?",
  "What is one thing you are proud of, however small?",
  "When did you last laugh, and what about?",
  "What is something in your home that you like having around?",
  "What is a small kindness you noticed today?",
  "What is one thing you can do slowly today?",
  "What is a song or sound that helps you relax?",
  "What is one thing your body did for you today?",
  "What can wait until tomorrow?",
  "What is one good thing about this moment, right now?",
];

const DAY_MS = 24 * 60 * 60 * 1000;

// The Beirut calendar day of `now` as a day number (days since 1 January 1970), so the question changes at
// midnight in Beirut whatever the device's time zone. Also used for "Today's message".
export function beirutDayNumber(now = new Date()) {
  const [year, month, day] = beirutDayString(now).split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function reflectionQuestionFor(now = new Date()) {
  return REFLECTION_QUESTIONS[beirutDayNumber(now) % REFLECTION_QUESTIONS.length];
}

// Bedtime wind-down: ticks stay on screen only.
export const WIND_DOWN_STEPS = [
  "Put your phone and other screens away.",
  "Dim the lights.",
  "Take a few slow breaths.",
  "Have a glass of water, if you like.",
];

// Shown with every exercise and at the end of each (components/wellbeing/WellbeingHelp.js).
export const HELP_SENTENCE = "If you're in danger, call 140 now. To talk to someone, call the National Lifeline 1564, available 24/7.";
export const WHEN_TO_REACH_OUT = [
  "You feel unsafe.",
  "You can't cope with daily life.",
  "You have thoughts of hurting yourself.",
];

// The exercises, as named on the Wellbeing Corner, the page and in the URL (/wellbeing?start=breathing).
export const EXERCISES = [
  { key: "breathing", title: "Breathing exercise", summary: "About 2 minutes of slow breathing, with a dot to follow. It can help you slow down." },
  { key: "grounding", title: "Grounding exercise", summary: "Five short steps that bring your attention back to what is around you." },
  { key: "reset", title: "5-minute reset", summary: "The breathing exercise, then grounding, then one question to think about." },
  { key: "wind-down", title: "Bedtime wind-down", summary: "A short checklist to help you get ready for sleep." },
];
