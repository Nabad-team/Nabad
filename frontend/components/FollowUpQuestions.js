// SCRUM-126: the follow-up questions returned by the triage API.
// The guided symptom check: questions come BEFORE the result. While the engine still has a question, the page shows
// this card instead of the result (pages/symptoms.js); the result appears once the questions are done or skipped.
// Each question is a group of radio buttons (fieldset + legend, so screen readers read the question before each
// choice). Questions are optional: the user can answer some, all, or skip straight to the result.
// SCRUM-280: when the AI picks the questions, one comes at a time (progress.oneAtATime), at most
// progress.maxRounds, and the page says so. "Skip to my result" ends the follow-up at any point.
// urgentSoFar: the result so far is urgent, so the card says so (with the engine's action) and offers the result now.
// An emergency never gets here: it is shown at once, with no questions.
import { useState } from "react";
import Button from "./ui/Button";
import Card from "./ui/Card";
import ReadAloudButton from "./ReadAloudButton";

export default function FollowUpQuestions({ questions, onSubmit, onSkip, busy, progress = null, urgentSoFar = null }) {
  const [answers, setAnswers] = useState({});

  if (!questions?.length) return null;

  const answeredCount = Object.keys(answers).length;
  const oneAtATime = Boolean(progress?.oneAtATime) && questions.length === 1;
  const spokenQuestions = questions
    .map((question, index) => {
      const options = question.options.map((option) => option.label).join(", ");
      return `Question ${index + 1}: ${question.text}. Options: ${options}.`;
    })
    .join(" ");

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(answers);
  }

  return (
    <Card as="form" id="follow-up" tabIndex={-1} onSubmit={handleSubmit} aria-labelledby="follow-up-heading" className="follow-up">
      <div className="follow-up__header">
        {oneAtATime && (
          <p className="follow-up__progress">
            Question {progress.round} of at most {progress.maxRounds}
          </p>
        )}
        <h2 id="follow-up-heading">{oneAtATime ? "A quick question" : "A few quick questions"}</h2>
        <p className="text-muted">
          {oneAtATime
            ? "Before we give you a result, we need to know a little more. We ask one at a time and stop as soon as we know enough."
            : "Before we give you a result, a few questions make it more accurate. Skip any you are not sure about."}
        </p>
      </div>

      {urgentSoFar && (
        <div className="follow-up__urgent" role="note">
          <p><strong>From what you told us so far, you may need care today.</strong></p>
          <p>{urgentSoFar.action}</p>
        </div>
      )}

      <p className="follow-up__read-aloud">
        <ReadAloudButton text={spokenQuestions} quiet />
      </p>

      {questions.map((question) => (
        <fieldset key={question.id} className="choice-group follow-up__question">
          <legend>{question.text}</legend>
          {question.options.map((option) => {
            const inputId = `${question.id}-${option.value}`;
            return (
              <label key={option.value} htmlFor={inputId} className="check follow-up__option">
                <input
                  type="radio"
                  id={inputId}
                  name={question.id}
                  value={option.value}
                  checked={answers[question.id] === option.value}
                  onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.value }))}
                />
                {option.label}
              </label>
            );
          })}
        </fieldset>
      ))}

      <div className="form-actions">
        <Button type="submit" disabled={busy || answeredCount === 0}>
          {busy ? "Checking..." : "Continue"}
        </Button>
        <Button variant="secondary" onClick={onSkip} disabled={busy}>
          {urgentSoFar ? "See my result now" : "Skip to my result"}
        </Button>
      </div>

      <p className="follow-up__emergency">
        <span>Can&apos;t breathe, chest pain, or fainting? Don&apos;t wait for the questions.</span>
        <a href="tel:140" className="button button--danger">Call 140</a>
      </p>
    </Card>
  );
}
