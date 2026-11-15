import { WellbeingSupportNumber } from "../WellbeingCorner";
import { wellbeingSupport, embraceWebsite } from "../../data/wellbeingSupport";
import { HELP_SENTENCE, WHEN_TO_REACH_OUT } from "../../lib/wellbeingExercises";
import { formatDate } from "../../lib/dates";

// Shown with every wellbeing exercise and at the end of each: 140 and 1564 with the existing call buttons, when to
// reach out, and Embrace's official website. Its headings start at h3 (the exercise panel or card is the h2).
export default function WellbeingHelp({ id = "wellbeing-help" }) {
  return (
    <section className="wellbeing-help" aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>Support if you need it</h3>
      <p className="wellbeing-help__urgent">{HELP_SENTENCE}</p>
      <div className="wellbeing-support__grid">
        {wellbeingSupport.map((contact) => <WellbeingSupportNumber key={contact.id} contact={contact} compact />)}
      </div>
      <h4 id={`${id}-reach-out`}>When to reach out</h4>
      <ul className="wellbeing-help__list" aria-labelledby={`${id}-reach-out`}>
        {WHEN_TO_REACH_OUT.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <p className="text-sm">
        The National Lifeline is run by Embrace with the Ministry of Public Health.{" "}
        <a href={embraceWebsite.url} target="_blank" rel="noopener noreferrer">Embrace&apos;s official website</a>{" "}
        <span className="text-muted">(checked on <time dateTime={embraceWebsite.verifiedOn}>{formatDate(embraceWebsite.verifiedOn)}</time>)</span>
      </p>
    </section>
  );
}
