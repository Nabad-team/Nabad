import { useEffect, useRef, useState } from "react";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { addSymptomRecord } from "../lib/symptomApi";
import { classifyUrgency, refineUrgency } from "../lib/triageApi";
import UrgencyResult from "../components/UrgencyResult";
import FollowUpQuestions from "../components/FollowUpQuestions";

export default function SymptomsPage() {
  const { activeProfile } = useActiveProfile();
  const [symptoms, setSymptoms] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [urgency, setUrgency] = useState(null); // SCRUM-128: result of the urgency classification
  // SCRUM-126: the box is cleared after saving, so the description is kept for /refine.
  const [lastDescription, setLastDescription] = useState("");
  const [followUps, setFollowUps] = useState([]);
  const [refining, setRefining] = useState(false);
  const [assessmentCount, setAssessmentCount] = useState(0); // new form (no old answers) per assessment
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const recognitionRef = useRef(null);
  const baseSymptomsRef = useRef("");
  const dictatedTextRef = useRef("");

  const SpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  const speechRecognitionSupported = Boolean(SpeechRecognition);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
    },
    []
  );

  function toggleSpeechInput() {
    if (!SpeechRecognition) {
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    baseSymptomsRef.current = symptoms.trim();
    dictatedTextRef.current = "";
    setSpeechError("");

    recognition.onresult = (event) => {
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;

        if (event.results[index].isFinal) {
          dictatedTextRef.current += `${transcript} `;
        } else {
          interimText += transcript;
        }
      }

      const dictatedText = dictatedTextRef.current + interimText;
      setSymptoms(
        [baseSymptomsRef.current, dictatedText.trim()].filter(Boolean).join(" ")
      );
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        setSpeechError("Voice input was unavailable. You can type your symptoms instead.");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch (startError) {
      console.error("Could not start voice input:", startError);
      setSpeechError("Voice input could not be started. You can type your symptoms instead.");
      setIsListening(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");
    setUrgency(null);
    setFollowUps([]);

    if (!activeProfile) {
      setError("No active profile selected.");
      return;
    }

    if (!symptoms.trim()) {
      setError("Please enter symptoms.");
      return;
    }

    const description = symptoms.trim();

    try {
      await addSymptomRecord(
        activeProfile.id,
        activeProfile.fullName,
        description
      );

      setMessage(`Symptoms recorded for ${activeProfile.fullName}.`);
      setSymptoms("");
    } catch (err) {
      console.error(err);
      setError("Could not save symptoms.");
      return;
    }

    // SCRUM-128: after saving, ask the backend how urgent this is and how soon to get care.
    // Saving and classifying are separate on purpose: if classification fails, the symptoms
    // are still saved, and the user is told what to do instead of seeing nothing.
    try {
      const result = await classifyUrgency(description);
      setUrgency(result);
      // SCRUM-126: emergencies come back with no questions, so nothing delays the call-140 advice.
      setFollowUps(result.followUpQuestions || []);
      setLastDescription(description);
      setAssessmentCount((count) => count + 1);
    } catch (err) {
      console.error(err);
      setError(
        "Your symptoms were saved, but we could not check how urgent they are right now. If you feel very unwell, call 140."
      );
    }
  }

  // SCRUM-126: send the answers; the backend re-classifies the description and applies them.
  async function handleFollowUpSubmit(answers) {
    setError("");
    setRefining(true);
    try {
      setUrgency(await refineUrgency(lastDescription, answers));
      setFollowUps([]);
    } catch (err) {
      console.error(err);
      // The first result stays on screen and the questions stay open so the user can retry.
      setError("We could not update the urgency with your answers. The result above still applies.");
    } finally {
      setRefining(false);
    }
  }

  if (!activeProfile) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>Symptom Entry</h1>
        <p>No active profile selected.</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: "700px",
        margin: "0 auto",
        padding: "2rem",
      }}
    >
      <h1>Enter Symptoms</h1>

      <p>
        You are entering symptoms for:
        <strong> {activeProfile.fullName}</strong>
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginTop: "1.5rem" }}>
          <label htmlFor="symptoms">
            <strong>Symptoms</strong>
          </label>

          <textarea
            id="symptoms"
            value={symptoms}
            onChange={(event) => setSymptoms(event.target.value)}
            placeholder={`Enter symptoms for ${activeProfile.fullName}`}
            rows="6"
            style={{
              display: "block",
              width: "100%",
              marginTop: "0.5rem",
              padding: "0.75rem",
              fontSize: "1rem",
            }}
          />

          {speechRecognitionSupported && (
            <button
              type="button"
              onClick={toggleSpeechInput}
              aria-pressed={isListening}
              style={{
                marginTop: "0.75rem",
                padding: "0.65rem 1rem",
                cursor: "pointer",
              }}
            >
              {isListening ? "Stop listening" : "Speak symptoms"}
            </button>
          )}

          <p
            role="status"
            aria-live="polite"
            style={{ marginTop: "0.5rem" }}
          >
            {isListening
              ? "Listening. Describe your symptoms, then stop listening when you are finished."
              : speechError}
          </p>
        </div>

        <button
          type="submit"
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1.5rem",
            cursor: "pointer",
          }}
        >
          Submit Symptoms
        </button>
      </form>

      {message && (
        <p
          style={{
            marginTop: "1rem",
          }}
        >
          {message}
        </p>
      )}

      <UrgencyResult result={urgency} preliminary={followUps.length > 0} />

      <FollowUpQuestions
        // A new key per assessment resets any half-filled answers from an earlier submission.
        key={assessmentCount}
        questions={followUps}
        onSubmit={handleFollowUpSubmit}
        onSkip={() => setFollowUps([])}
        busy={refining}
      />

      {error && (
        <p
          style={{
            marginTop: "1rem",
          }}
        >
          {error}
        </p>
      )}
    </main>
  );
}