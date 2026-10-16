import Card from "./ui/Card";

const dailyMessages = [
  "Take things one step at a time today.",
  "A short break can help you reset.",
  "You do not have to handle everything at once.",
  "Try to make time for rest, food, and hydration.",
  "Checking in with someone you trust can help.",
  "It is okay to slow down when things feel heavy.",
  "A few quiet minutes can make the next step feel easier.",
  "You can focus on what is manageable right now.",
  "Rest is part of taking care of yourself.",
  "A small positive step still counts.",
  "Try to notice one thing around you that feels calm or familiar.",
  "You do not need to solve everything today.",
  "Taking care of basic needs can help when stress builds up.",
  "Give yourself permission to pause for a moment.",
  "Talking about how you feel can make things feel less overwhelming.",
  "Try to be as patient with yourself as you would be with someone you care about.",
  "A difficult day does not mean every day will feel the same.",
  "You can take today in smaller pieces.",
  "If your mind feels busy, focus on one simple task at a time.",
  "Reaching out for support is a reasonable next step when things feel too much.",
  "A glass of water, a meal, or some rest can be a useful place to start.",
  "Try stepping away from the screen for a few minutes if you can.",
  "You are allowed to make space for recovery and rest.",
  "Slow breathing can help your body settle when you feel tense.",
  "Staying connected with people you trust can help during stressful times.",
];

function getDailyMessage() {
  const day = new Date().getDate();
  return dailyMessages[day % dailyMessages.length];
}

export default function WellbeingCorner() {
  const dailyMessage = getDailyMessage();

  return (
    <Card
      aria-labelledby="wellbeing-corner-heading"
      className="section"
    >
      <h2 id="wellbeing-corner-heading">
        Wellbeing Corner
      </h2>

      <h3>Today&apos;s message</h3>

      <p>{dailyMessage}</p>

      <h3>Simple wellbeing tips</h3>

      <ul>
        <li>Take a short break if you feel overwhelmed.</li>
        <li>Drink water and try to eat regularly.</li>
        <li>Try slow breathing for a few minutes.</li>
        <li>Talk to someone you trust if you need support.</li>
      </ul>

      <h3>Support in Lebanon</h3>

      <p>
        <strong>National Lifeline 1564</strong>
      </p>

      <p>
        Psychological support and suicide prevention hotline,
        available 24/7 in partnership with Embrace.
      </p>

      <p>
        <a href="tel:1564">
          Call 1564
        </a>
      </p>

      <p>
        <strong>Lebanese Red Cross 140</strong>
      </p>

      <p>
        If you or someone else is in immediate danger or needs
        emergency medical help, call the Lebanese Red Cross.
      </p>

      <p>
        <a href="tel:140">
          Call 140
        </a>
      </p>

      <p>
        <small>
          Numbers last verified: October 16, 2026
        </small>
      </p>
    </Card>
  );
}