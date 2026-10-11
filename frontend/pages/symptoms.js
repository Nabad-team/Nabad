import { useEffect, useRef, useState } from "react";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { addSymptomRecord } from "../lib/symptomApi";
import { classifyUrgency, refineUrgency } from "../lib/triageApi";
import UrgencyResult from "../components/UrgencyResult";
import FollowUpQuestions from "../components/FollowUpQuestions";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import { PersonWithPhone } from "../components/illustrations";

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
  const voiceRequestHandledRef = useRef(false);

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

  // Opened from the dashboard's "Speak" button (/symptoms?voice=1): start listening straight away,
  // once the profile is known. The ref makes sure this happens only once per visit.
  useEffect(() => {
    if (!activeProfile || voiceRequestHandledRef.current) return;
    voiceRequestHandledRef.current = true;
    if (new URLSearchParams(window.location.search).get("voice") === "1") toggleSpeechInput();
  }, [activeProfile]);

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
      <PageLayout title="Enter symptoms">
        <PageTitle>Symptom entry</PageTitle>
        <EmptyState illustration={<PersonWithPhone size="5rem" />} title="No active profile selected." />
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Enter symptoms">
      <PageTitle>Enter symptoms</PageTitle>

      <p>
        You are entering symptoms for:
        <strong> {activeProfile.fullName}</strong>
      </p>

      <form onSubmit={handleSubmit} className="form symptoms-form">
        <div className="field">
          <Input
            as="textarea"
            id="symptoms"
            label="Symptoms"
            value={symptoms}
            onChange={(event) => setSymptoms(event.target.value)}
            placeholder="For example: headache since yesterday and a mild fever."
            rows="6"
          />

          {speechRecognitionSupported && (
            <div>
              <Button variant="secondary" onClick={toggleSpeechInput} aria-pressed={isListening}>
                {isListening ? "Stop listening" : "Speak symptoms"}
              </Button>
            </div>
          )}

          <p role="status" aria-live="polite" className="field__hint">
            {isListening
              ? "Listening. Describe your symptoms, then stop listening when you are finished."
              : speechError}
          </p>
        </div>

        <div className="form-actions">
          <Button type="submit">Submit symptoms</Button>
        </div>
      </form>

      {message && <Alert tone="success" as="p" className="symptoms-message">{message}</Alert>}

      <UrgencyResult result={urgency} preliminary={followUps.length > 0} />

      <FollowUpQuestions
        // A new key per assessment resets any half-filled answers from an earlier submission.
        key={assessmentCount}
        questions={followUps}
        onSubmit={handleFollowUpSubmit}
        onSkip={() => setFollowUps([])}
        busy={refining}
      />

      {error && <Alert tone="danger" as="p" className="symptoms-message">{error}</Alert>}
    </PageLayout>
  );
}
