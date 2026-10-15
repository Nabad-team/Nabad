// SCRUM-130 (backlog #29): "As a user, I want a plain-language explanation of why a recommendation
// was given so that I trust the result."
//
// Shows result.explanation from the triage API (backend/src/triage/explanation.js):
//   - the one-sentence summary (always shown, also in simplified mode)
//   - what the user told us that led to it, and what each thing can mean
//   - the follow-up answers that made it more urgent
//   - warning signs the user said they don't have, so they can spot a misreading
//   - when to get help sooner (always shown: it is the safety advice)
//   - what the result was based on
// Everything here is text from our own API, rendered as text (React escapes it).

const quote = (words) => `“${words}”`;

function joinList(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export default function UrgencyExplanation({ explanation, isEmergency = false, simplified = false }) {
  if (!explanation?.summary) return null;
  const { summary, triggers = [], changedBy = [], notCounted = [], watchFor = [], basedOn } = explanation;

  return (
    <div className="urgency__explanation">
      <h3 className="urgency__why">Why we suggest this</h3>
      <p>{summary}</p>

      {!simplified && triggers.length > 0 && (
        <>
          <p className="urgency__label"><strong>What you told us:</strong></p>
          <ul>
            {triggers.map((trigger) => (
              <li key={trigger.words.join("|")}>
                {joinList(trigger.words.map(quote))}: {trigger.meaning}
              </li>
            ))}
          </ul>
        </>
      )}

      {!simplified && changedBy.length > 0 && (
        <>
          <p className="urgency__label"><strong>Your answers that made it more urgent:</strong></p>
          <ul>
            {changedBy.map((change) => (
              <li key={change.question}>
                {change.question} You answered <strong>{quote(change.answer)}</strong>. {change.effect}
              </li>
            ))}
          </ul>
        </>
      )}

      {!simplified && notCounted.length > 0 && (
        <p>
          <strong>Not counted:</strong> you said you don&apos;t have {joinList(notCounted.map(quote))}, so{" "}
          {notCounted.length === 1 ? "it was" : "they were"} not counted. If that&apos;s wrong, describe your symptoms again.
        </p>
      )}

      {watchFor.length > 0 && (
        isEmergency ? (
          <p><strong>{watchFor[0]}</strong></p>
        ) : (
          <>
            <p className="urgency__label"><strong>Get help sooner if things change:</strong></p>
            <ul>
              {watchFor.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </>
        )
      )}

      {!simplified && basedOn && <p className="text-sm">Based on {basedOn}</p>}
    </div>
  );
}
