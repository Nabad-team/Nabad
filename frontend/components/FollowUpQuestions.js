// SCRUM-126: the follow-up questions returned by POST /api/triage/classify.
// Each question is a group of radio buttons (fieldset + legend, so screen readers read the
// question before each choice). Questions are optional: the user can answer some, all, or skip.
import { useState } from "react";

const TEAL = "#0f766e";

export default function FollowUpQuestions({ questions, onSubmit, onSkip, busy }) {
  const [answers, setAnswers] = useState({});

  if (!questions?.length) return null;

  const answeredCount = Object.keys(answers).length;

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(answers);
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby="follow-up-heading"
      style={{ marginTop: "1.5rem", padding: "1rem 1.25rem", border: "1px solid #d1d5db", borderRadius: "10px" }}
    >
      <h2 id="follow-up-heading" style={{ marginTop: 0 }}>
        A few quick questions
      </h2>
      <p style={{ marginTop: 0 }}>Your answers make the urgency level more accurate. Skip any you are not sure about.</p>

      {questions.map((question) => (
        <fieldset key={question.id} style={{ border: 0, padding: 0, margin: "0 0 1.25rem" }}>
          <legend style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>{question.text}</legend>
          {question.options.map((option) => {
            const inputId = `${question.id}-${option.value}`;
            return (
              <div key={option.value} style={{ marginBottom: "0.35rem" }}>
                <input
                  type="radio"
                  id={inputId}
                  name={question.id}
                  value={option.value}
                  checked={answers[question.id] === option.value}
                  onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.value }))}
                />{" "}
                <label htmlFor={inputId}>{option.label}</label>
              </div>
            );
          })}
        </fieldset>
      ))}

      <button
        type="submit"
        disabled={busy || answeredCount === 0}
        style={{ padding: "0.65rem 1.25rem", background: TEAL, color: "white", border: 0, borderRadius: "8px", cursor: "pointer" }}
      >
        {busy ? "Updating..." : "Update my urgency"}
      </button>{" "}
      <button type="button" onClick={onSkip} disabled={busy} style={{ padding: "0.65rem 1.25rem", cursor: "pointer" }}>
        Skip questions
      </button>
    </form>
  );
}
