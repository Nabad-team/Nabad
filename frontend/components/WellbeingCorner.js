import Card from "./ui/Card";
import Button from "./ui/Button";
import { BreathingRings } from "./ui/BreathingDot";
import HeldIcon from "./ui/HeldIcon";
import { formatDate } from "../lib/dates";
import { wellbeingSupport } from "../data/wellbeingSupport";
import { beirutDayNumber } from "../lib/wellbeingExercises";

// compact: a call row (the dashboard and Wellbeing cards, and the help under every exercise): the name, a small
// "24/7 · verified <date>" line (the Red Cross: "Emergency · verified <date>"), the number itself as the call button
// (1564 in spruce, 140 in danger) and a small link to the official source. The row's accessible name is the full
// name with the number ("Lebanese Red Cross 140"); the number shows once, on the button. The longer description is
// in the card's "More" section.
export function WellbeingSupportNumber({ contact, compact = false }) {
  const value = contact.verifiedOn;
  const parsed = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  const date = parsed && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
  const source = typeof contact.sourceUrl === "string" && /^https:\/\//.test(contact.sourceUrl) ? contact.sourceUrl : null;
  const emergency = contact.id === "lebanese-red-cross";
  if (compact) {
    return <section className={`wellbeing-support-number wellbeing-support-number--row${emergency ? " wellbeing-support-number--emergency" : ""}`} aria-label={contact.name}>
      <div className="wellbeing-support-number__content">
        <p className="wellbeing-support-number__name" aria-hidden="true">{contact.name.replace(/\s*\d+$/, "")}</p>
        <p className="wellbeing-support-number__meta">
          <small>{emergency ? "Emergency" : "24/7"} · {date ? <>verified <time dateTime={date}>{formatDate(date)}</time></> : "verification date unavailable"}</small>
          {source && <> · <a href={source} target="_blank" rel="noopener noreferrer" aria-label={`Official verification source for ${contact.name}`}>Official source</a></>}
        </p>
      </div>
      <Button className="wellbeing-support-number__call" variant={emergency ? "danger" : "primary"} href={`tel:${contact.phone}`} aria-label={`Call ${contact.phone}`}>
        <HeldIcon name="phone" size="1.125rem" /><span className="wellbeing-support-number__phone">{contact.phone}</span>
      </Button>
    </section>;
  }
  return <section className={`wellbeing-support-number${emergency ? " wellbeing-support-number--emergency" : ""}${compact ? " wellbeing-support-number--row" : ""}`} aria-labelledby={`wellbeing-support-${contact.id}`}>
    <div className="wellbeing-support-number__icon" aria-hidden="true">
      <HeldIcon name="phone" size="1.25rem" />
    </div>
    <div className="wellbeing-support-number__content">
      <p className="wellbeing-support-number__label">{emergency ? "Emergency medical help" : "Mental health support · Available 24/7"}</p>
      <h4 id={`wellbeing-support-${contact.id}`}>{contact.name}</h4>
      {!compact && <p>{contact.description}</p>}
      <Button className="wellbeing-support-number__call" variant={emergency ? "danger" : "primary"} size={compact ? "small" : undefined} href={`tel:${contact.phone}`} aria-label={`Call ${contact.phone}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.5 10 8.2 7.8 10c1.3 2.6 3.5 4.8 6.1 6.1l1.9-2.2 4.7 2.8-.8 3.1c-.2.8-1 1.4-1.9 1.3C10 20.3 3.7 14 2.9 6.2c-.1-.9.5-1.7 1.3-1.9l3-.8Z" /></svg>
        {compact ? <span>Call</span> : <span><small>Tap to call</small>{contact.phone}</span>}
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

// Changes at midnight in Beirut (like the question of the day), whatever the device's time zone.
function getDailyMessage(now = new Date()) {
  return dailyMessages[beirutDayNumber(now) % dailyMessages.length];
}

// Two minutes to breathe: the breathing dot in its still rings, the title, the timing and one spruce Start.
export function BreatheHero() {
  return (
    <section className="breathe-hero" aria-labelledby="breathe-hero-heading">
      <BreathingRings size="6rem" className="breathe-hero__rings" />
      <div className="breathe-hero__text">
        <h3 id="breathe-hero-heading" className="breathe-hero__title">Two minutes to breathe</h3>
        <p className="breathe-hero__timing">In for <span className="num">4</span>, hold for <span className="num">4</span>, out for <span className="num">6</span></p>
        <Button href="/wellbeing?start=breathing" size="small" aria-describedby="breathe-hero-heading">Start</Button>
      </div>
    </section>
  );
}

// The dashboard's wellbeing card, soft green: the label "Wellbeing", the two helplines in one white block, then two
// minutes to breathe as the hero, then today's message as a quoted line. The helplines come first because the
// self-harm result links here (/dashboard#wellbeing-corner-heading): someone sent here for support sees them before
// anything else. The tips and notes are under "More". The calm exercises and the question of the day live on
// /wellbeing only. 140 appears once in the card (the page footer also has it).
export default function WellbeingCorner() {
  const dailyMessage = getDailyMessage();
  const lifeline = wellbeingSupport.find((contact) => contact.id !== "lebanese-red-cross");

  return (
    <Card aria-labelledby="wellbeing-corner-heading" className="section wellbeing-corner wellbeing-corner--compact">
      <h2 id="wellbeing-corner-heading" className="wellbeing-corner__label">Wellbeing</h2>

      <section className="wellbeing-support" aria-labelledby="wellbeing-support-heading">
        <h3 id="wellbeing-support-heading" className="visually-hidden">Support in Lebanon</h3>
        <div className="wellbeing-support__grid wellbeing-support__block">{wellbeingSupport.map(contact => <WellbeingSupportNumber key={contact.id} contact={contact} compact />)}</div>
      </section>

      {/* After the support numbers, so someone sent here for support (the self-harm result) sees those first. */}
      <BreatheHero />

      <section className="wellbeing-message wellbeing-message--quote" aria-labelledby="wellbeing-message-heading">
        <h3 id="wellbeing-message-heading" className="visually-hidden">Today&apos;s message</h3>
        <blockquote><p>“{dailyMessage}”</p></blockquote>
      </section>

      <details className="wellbeing-corner__more">
        <summary>More<span className="visually-hidden"> wellbeing tips and support details</span><svg className="wellbeing-corner__chevron" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg></summary>
        <section className="wellbeing-tips" aria-labelledby="wellbeing-tips-heading">
          <h3 id="wellbeing-tips-heading">Simple wellbeing tips</h3>
          <ul>
            <li><span aria-hidden="true">⏸</span>Take a short break if you feel overwhelmed.</li>
            <li><span aria-hidden="true">●</span>Drink water and try to eat regularly.</li>
            <li><span aria-hidden="true">〰</span>Try slow breathing for a few minutes.</li>
            <li><span aria-hidden="true">♡</span>Talk to someone you trust if you need support.</li>
          </ul>
        </section>
        {lifeline && <p className="wellbeing-corner__about">{lifeline.description}</p>}
        <p className="text-muted wellbeing-support__note"><small>Calls open your phone app. Verification dates show when the published contact information was checked, not a live phone-line availability check. Availability can change.</small></p>
      </details>
    </Card>
  );
}
