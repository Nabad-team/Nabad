import Card from "./ui/Card";
import Button from "./ui/Button";
import { formatDate } from "../lib/dates";
import { wellbeingSupport } from "../data/wellbeingSupport";

export function WellbeingSupportNumber({ contact }) {
  const value = contact.verifiedOn;
  const parsed = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  const date = parsed && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
  const source = typeof contact.sourceUrl === "string" && /^https:\/\//.test(contact.sourceUrl) ? contact.sourceUrl : null;
  const emergency = contact.id === "lebanese-red-cross";
  return <section className={`wellbeing-support-number${emergency ? " wellbeing-support-number--emergency" : ""}`} aria-labelledby={`wellbeing-support-${contact.id}`}>
    <div className="wellbeing-support-number__icon" aria-hidden="true">
      {emergency ? <svg viewBox="0 0 24 24"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" /></svg> : <svg viewBox="0 0 24 24"><path d="M4 13a8 8 0 0 1 16 0" /><path d="M4 13v5h4v-5H4Zm12 0v5h4v-5h-4ZM16 20h-4" /></svg>}
    </div>
    <div className="wellbeing-support-number__content">
      <p className="wellbeing-support-number__label">{emergency ? "Emergency medical help" : "Mental health support · Available 24/7"}</p>
      <h4 id={`wellbeing-support-${contact.id}`}>{contact.name}</h4>
      <p>{contact.description}</p>
      <Button className="wellbeing-support-number__call" variant={emergency ? "danger" : "primary"} href={`tel:${contact.phone}`} aria-label={`Call ${contact.phone}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.5 10 8.2 7.8 10c1.3 2.6 3.5 4.8 6.1 6.1l1.9-2.2 4.7 2.8-.8 3.1c-.2.8-1 1.4-1.9 1.3C10 20.3 3.7 14 2.9 6.2c-.1-.9.5-1.7 1.3-1.9l3-.8Z" /></svg>
        <span><small>Tap to call</small>{contact.phone}</span>
      </Button>
      <div className="wellbeing-support-number__meta">
        <small>{date ? <>Last verified: <time dateTime={date}>{formatDate(date)}</time></> : "Verification date unavailable."}</small>
        {source && <a href={source} target="_blank" rel="noopener noreferrer" aria-label={`Official verification source for ${contact.name}`}>Official source <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-9 9M19 14v5H5V5h5" /></svg></a>}
      </div>
    </div>
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
    <Card aria-labelledby="wellbeing-corner-heading" className="section wellbeing-corner">
      <div className="wellbeing-corner__heading">
        <div><p className="wellbeing-corner__eyebrow">Care for mind and body</p><h2 id="wellbeing-corner-heading">Wellbeing Corner</h2></div>
        <span className="wellbeing-corner__heart" aria-hidden="true">♥</span>
      </div>

      <section className="wellbeing-message" aria-labelledby="wellbeing-message-heading">
        <span aria-hidden="true">☀</span>
        <div><h3 id="wellbeing-message-heading">Today&apos;s message</h3><p>{dailyMessage}</p></div>
      </section>

      <section className="wellbeing-tips" aria-labelledby="wellbeing-tips-heading">
        <h3 id="wellbeing-tips-heading">Simple wellbeing tips</h3>
        <ul>
          <li><span aria-hidden="true">⏸</span>Take a short break if you feel overwhelmed.</li>
          <li><span aria-hidden="true">●</span>Drink water and try to eat regularly.</li>
          <li><span aria-hidden="true">〰</span>Try slow breathing for a few minutes.</li>
          <li><span aria-hidden="true">♡</span>Talk to someone you trust if you need support.</li>
        </ul>
      </section>

      <section className="wellbeing-support" aria-labelledby="wellbeing-support-heading">
        <div className="wellbeing-support__heading"><div><p className="wellbeing-corner__eyebrow">Help when you need it</p><h3 id="wellbeing-support-heading">Support in Lebanon</h3></div><span>Calls open your phone app</span></div>
        <div className="wellbeing-support__grid">{wellbeingSupport.map(contact => <WellbeingSupportNumber key={contact.id} contact={contact} />)}</div>
        <p className="text-muted wellbeing-support__note"><small>Verification dates show when the published contact information was checked, not a live phone-line availability check. Availability can change.</small></p>
      </section>
    </Card>
  );
}
