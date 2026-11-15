// The dashboard's "Getting started" card (components/GettingStartedCard.js): four first steps for the profile
// being viewed, each ticked from data the dashboard loads anyway. Nothing about the steps is stored or tracked;
// only "Hide" (or finishing all four on your own profile) is remembered, as one flag on the account.
import { BASICS, basicsFilled } from "./healthProfile";

// The emergency information card "has content" when it shows something the other steps don't already cover: an
// emergency contact, a long-term condition or an allergy (backend/src/routes/emergencyCard.js). Its blood type is a
// health basic (step 1) and its medications are step 2, so they don't tick this one on their own. A family
// member's card has no contact of its own to set here, so their conditions or allergies (My health) complete it.
export function emergencyCardHasContent(card) {
  if (!card) return false;
  return Boolean(card.emergencyContact?.phone || card.conditions?.length || card.allergies?.length);
}

// data: { health, medications, symptoms, emergencyCard } as loaded for the active profile.
// forName: the linked profile's first name ("Sami"), "" for your own profile.
export function gettingStartedSteps({ health, medications, symptoms, emergencyCard }, forName = "") {
  const whose = forName ? `${forName}'s` : "your";
  return [
    {
      key: "health",
      text: `Add ${whose} health basics`,
      hint: `Date of birth, sex, height, weight and blood type help Nabad give safer guidance.`,
      action: "Open my health", href: "/my-health",
      done: Boolean(health) && basicsFilled(health) === BASICS.length,
    },
    {
      key: "medication",
      text: forName ? `Add a medication ${forName} takes` : "Add a medication you take",
      hint: "So the list is ready for a doctor or an emergency.",
      action: "Open my medications", href: "/medications",
      done: (medications || []).length > 0,
    },
    {
      key: "symptoms",
      text: forName ? `Try a symptom check for ${forName}` : "Try a symptom check",
      hint: "Describe how you feel and see how urgent it may be.",
      action: "Check symptoms", href: "/symptoms",
      done: (symptoms || []).length > 0,
    },
    {
      key: "emergency-card",
      text: `Set up ${whose} emergency information card`,
      hint: forName ? "Allergies or long-term conditions, ready to show in an emergency." : "An emergency contact, allergies or long-term conditions, ready to show in an emergency.",
      action: "Open the card", href: "/emergency-card",
      done: emergencyCardHasContent(emergencyCard),
    },
  ];
}

export const doneCount = (steps) => steps.filter((step) => step.done).length;
export const progressText = (steps) => `${doneCount(steps)} of ${steps.length} done`;
export const allDone = (steps) => doneCount(steps) === steps.length;
