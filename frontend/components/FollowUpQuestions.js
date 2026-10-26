// SCRUM-126: the follow-up questions returned by POST /api/triage/classify.
// Each question is a group of radio buttons (fieldset + legend, so screen readers read the
// question before each choice). Questions are optional: the user can answer some, all, or skip.
// SCRUM-280: when the AI picks the questions, one comes at a time (progress.oneAtATime), at most
// progress.maxRounds, and the page says so. "Skip questions" ends the follow-up at any point.
import { useState } from "react";
import Button from "./ui/Button";
import Card from "./ui/Card";
import ReadAloudButton from "./ReadAloudButton";

export default function FollowUpQuestions({ questions, onSubmit, onSkip, busy, progress = null }) {
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
    <Card as="form" onSubmit={handleSubmit} aria-labelledby="follow-up-heading" className="follow-up">
      <h2 id="follow-up-heading">{oneAtATime ? "A quick question" : "A few quick questions"}</h2>
      {oneAtATime ? (
        <p className="text-muted">
          Question {progress.round} of at most {progress.maxRounds}. We ask one at a time and stop as soon as we know enough.
        </p>
      ) : (
        <p className="text-muted">Your answers make the urgency level more accurate. Skip any you are not sure about.</p>
      )}
      <p>
        <ReadAloudButton text={spokenQuestions} />
      </p>

      {questions.map((question) => (
        <fieldset key={question.id} className="choice-group">
          <legend>{question.text}</legend>
          {question.options.map((option) => {
            const inputId = `${question.id}-${option.value}`;
            return (
              <label key={option.value} htmlFor={inputId} className="check">
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
          {busy ? "Updating..." : "Update my urgency"}
        </Button>
        <Button variant="secondary" onClick={onSkip} disabled={busy}>
          Skip questions
        </Button>
      </div>
    </Card>
  );
}
