// SCRUM-126: the follow-up questions returned by POST /api/triage/classify.
// Each question is a group of radio buttons (fieldset + legend, so screen readers read the
// question before each choice). Questions are optional: the user can answer some, all, or skip.
import { useState } from "react";
import Button from "./ui/Button";
import Card from "./ui/Card";

export default function FollowUpQuestions({ questions, onSubmit, onSkip, busy }) {
  const [answers, setAnswers] = useState({});

  if (!questions?.length) return null;

  const answeredCount = Object.keys(answers).length;

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(answers);
  }

  return (
    <Card as="form" onSubmit={handleSubmit} aria-labelledby="follow-up-heading" className="follow-up">
      <h2 id="follow-up-heading">A few quick questions</h2>
      <p className="text-muted">Your answers make the urgency level more accurate. Skip any you are not sure about.</p>

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
