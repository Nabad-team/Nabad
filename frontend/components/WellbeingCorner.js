import Card from "./ui/Card";
import { formatDate } from "../lib/dates";
import { wellbeingSupport } from "../data/wellbeingSupport";

export function WellbeingSupportNumber({ contact }) {
  const value = contact.verifiedOn;
  const parsed = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  const date = parsed && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
  const source = typeof contact.sourceUrl === "string" && /^https:\/\//.test(contact.sourceUrl) ? contact.sourceUrl : null;
  return <section className="wellbeing-support-number" aria-labelledby={`wellbeing-support-${contact.id}`}>
    <h4 id={`wellbeing-support-${contact.id}`}>{contact.name}</h4>
    <p>{contact.description}</p>
    <p><a href={`tel:${contact.phone}`}>Call {contact.phone}</a></p>
    <p><small>{date ? <>Last verified: <time dateTime={date}>{formatDate(date)}</time></> : "Verification date unavailable."}</small></p>
    {source && <p><a href={source} target="_blank" rel="noopener noreferrer" aria-label={`Official verification source for ${contact.name}`}>Official source</a></p>}
  </section>;
}

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

      {wellbeingSupport.map(contact => <WellbeingSupportNumber key={contact.id} contact={contact} />)}
      <p className="text-muted"><small>Dates show when published contact information was checked, not a live phone-line availability check. Availability can change.</small></p>
    </Card>
  );
}
