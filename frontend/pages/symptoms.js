import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useActiveProfile,
} from "../context/ActiveProfileContext";

import {
  addSymptomRecord,
  getSymptomsForProfile,
  updateSymptomRecord,
} from "../lib/symptomApi";

import {
  assessUrgency,
  assessUrgencyWithAnswers,
} from "../lib/triageApi";

import {
  getEmergencyContact,
} from "../lib/api";

import UrgencyResult from "../components/UrgencyResult";
import FollowUpQuestions from "../components/FollowUpQuestions";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";

import {
  PersonWithPhone,
} from "../components/illustrations";

import {
  useAccessibility,
} from "../context/AccessibilityContext";


// Same limits as the API.
const MIN_LENGTH = 3;
const MAX_LENGTH = 2000;

const SHOW_COUNT_FROM = 1500;


export default function SymptomsPage() {
  const {
    activeProfile,
  } = useActiveProfile();

  const {
    preferences,
  } = useAccessibility();

  const simplified =
    preferences.simplifiedMode;

  const [
    symptoms,
    setSymptoms,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    urgency,
    setUrgency,
  ] = useState(null);

  const [
    emergencyContact,
    setEmergencyContact,
  ] = useState(null);

  const [
    lastDescription,
    setLastDescription,
  ] = useState("");

  const [
    followUps,
    setFollowUps,
  ] = useState([]);

  const [
    refining,
    setRefining,
  ] = useState(false);

  const [
    assessmentCount,
    setAssessmentCount,
  ] = useState(0);

  const [savedRecord, setSavedRecord] = useState(null);
  const [history, setHistory] = useState([]);

  const [
    isListening,
    setIsListening,
  ] = useState(false);

  const [
    speechError,
    setSpeechError,
  ] = useState("");

  const recognitionRef =
    useRef(null);

  const baseSymptomsRef =
    useRef("");

  const dictatedTextRef =
    useRef("");

  const voiceRequestHandledRef =
    useRef(false);


  const SpeechRecognition =
    typeof window !== "undefined" &&
    (
      window.SpeechRecognition ||
      window.webkitSpeechRecognition
    );

  const speechRecognitionSupported =
    Boolean(SpeechRecognition);


  useEffect(
    () => () => {
      recognitionRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    let current = true;
    setSavedRecord(null);
    setHistory([]);
    if (activeProfile?.id) {
      getSymptomsForProfile(activeProfile.id)
        .then((records) => {
          if (current && records.length > 0) {
            setHistory((existing) => {
              const fetchedIds = new Set(records.map((record) => record.id));
              return [...existing.filter((record) => !fetchedIds.has(record.id)), ...records];
            });
          }
        })
        .catch(() => { if (current) setHistory([]); });
    }
    return () => { current = false; };
  }, [activeProfile?.id]);


  function toggleSpeechInput() {
    if (!SpeechRecognition) {
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition =
      new SpeechRecognition();

    recognitionRef.current =
      recognition;

    recognition.continuous =
      true;

    recognition.interimResults =
      true;

    recognition.lang =
      "en-US";

    baseSymptomsRef.current =
      symptoms.trim();

    dictatedTextRef.current =
      "";

    setSpeechError("");


    recognition.onresult = (
      event
    ) => {
      let interimText = "";

      for (
        let index =
          event.resultIndex;

        index <
        event.results.length;

        index += 1
      ) {
        const transcript =
          event.results[index][0]
            .transcript;

        if (
          event.results[index]
            .isFinal
        ) {
          dictatedTextRef.current +=
            `${transcript} `;
        } else {
          interimText +=
            transcript;
        }
      }

      const dictatedText =
        dictatedTextRef.current +
        interimText;

      setSymptoms(
        [
          baseSymptomsRef.current,
          dictatedText.trim(),
        ]
          .filter(Boolean)
          .join(" ")
          .slice(
            0,
            MAX_LENGTH
          )
      );
    };


    recognition.onerror = (
      event
    ) => {
      if (
        event.error !==
        "aborted"
      ) {
        setSpeechError(
          "Voice input was unavailable. You can type your symptoms instead."
        );
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
      console.error(
        "Could not start voice input:",
        startError
      );

      setSpeechError(
        "Voice input could not be started. You can type your symptoms instead."
      );

      setIsListening(false);
    }
  }


  // Opened from the dashboard's Speak button.
  useEffect(() => {
    if (
      !activeProfile ||
      voiceRequestHandledRef.current
    ) {
      return;
    }

    voiceRequestHandledRef.current =
      true;

    if (
      new URLSearchParams(
        window.location.search
      ).get("voice") === "1"
    ) {
      toggleSpeechInput();
    }
  }, [activeProfile]);


  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    setMessage("");
    setError("");
    setUrgency(null);
    setEmergencyContact(null);
    setFollowUps([]);


    if (!activeProfile) {
      setError(
        "No active profile selected."
      );

      return;
    }


    if (!symptoms.trim()) {
      setError(
        "Please enter symptoms."
      );

      return;
    }


    const description =
      symptoms.trim();


    if (
      description.length <
      MIN_LENGTH
    ) {
      setError(
        'Please describe your symptoms in a few words, for example "headache since this morning".'
      );

      return;
    }


    try {
      // First ask Aref's triage engine
      // to assess the symptoms.
      const result =
        await assessUrgency(
          description,
          activeProfile.id
        );


      // Save BOTH the symptom description
      // and its urgency result on the backend.
      const saved = await addSymptomRecord(
        activeProfile.id,
        activeProfile.fullName,
        description,
        result
      );
      setSavedRecord(saved);
      setHistory((records) => [saved, ...records]);


      // Show the urgency result.
      setUrgency(result);


      // If this is an emergency,
      // also load the user's saved
      // emergency contact.
      if (
        result.level === "emergency"
      ) {
        try {
          const contactResponse =
            await getEmergencyContact();

          setEmergencyContact(
            contactResponse.contact ||
              null
          );
        } catch {
          // The emergency result must still
          // be shown even if the contact
          // cannot be loaded.
          setEmergencyContact(null);
        }
      }


      // Emergencies normally return
      // no follow-up questions.
      setFollowUps(
        result.followUpQuestions ||
          []
      );


      // Keep the description so
      // follow-up answers can refine it.
      setLastDescription(
        description
      );


      setAssessmentCount(
        (count) =>
          count + 1
      );


      setMessage(
        `Symptoms recorded for ${activeProfile.fullName}.`
      );


      // Clear the text box after
      // successful storage.
      setSymptoms("");
    } catch (err) {
      console.error(err);

      setError(
        err.status === 429
          ? err.message
          : "We could not check and save your symptoms right now. If you feel very unwell, call 140."
      );
    }
  }


  async function handleFollowUpSubmit(
    answers
  ) {
    setError("");

    setRefining(true);

    try {
      const updatedResult =
        await assessUrgencyWithAnswers(
          lastDescription,
          answers,
          activeProfile.id
        );

      setUrgency(
        updatedResult
      );

      if (savedRecord?.id) {
        const updated = await updateSymptomRecord(
          activeProfile.id,
          savedRecord.id,
          answers,
          updatedResult
        );
        setSavedRecord(updated);
        setHistory((records) => records.map((item) => item.id === updated.id ? updated : item));
      }

      setFollowUps([]);
    } catch (err) {
      console.error(err);

      setError(
        "We could not update the urgency with your answers. The result above still applies."
      );
    } finally {
      setRefining(false);
    }
  }


  const emergencyContactPhone =
    emergencyContact?.phone
      ? String(
          emergencyContact.phone
        ).replace(
          /[^\d+]/g,
          ""
        )
      : "";


  if (!activeProfile) {
    return (
      <PageLayout
        title="Enter symptoms"
        header={
          <ProfileHeader
            showPicture={false}
          />
        }
      >
        <PageTitle>
          Symptom entry
        </PageTitle>

        <EmptyState
          illustration={
            <PersonWithPhone
              size="5rem"
            />
          }
          title="No active profile selected."
        />
      </PageLayout>
    );
  }


  return (
    <PageLayout
      title="Enter symptoms"
      header={
        <ProfileHeader
          showPicture={false}
        />
      }
    >
      <PageTitle>
        {simplified
          ? "Tell us how you feel"
          : "Enter symptoms"}
      </PageTitle>

      <p>
        {simplified
          ? "For: "
          : "You are entering symptoms for:"}

        <strong>
          {" "}
          {activeProfile.fullName}
        </strong>
      </p>


      <form
        onSubmit={handleSubmit}
        className="form symptoms-form"
      >
        <div className="field">
          <Input
            as="textarea"
            id="symptoms"
            label="Symptoms"
            hint={
              simplified
                ? "Say it in your own words."
                : "Use your own words, by typing or speaking. Say what you feel, where, since when, and how bad it is."
            }
            value={symptoms}
            onChange={(event) =>
              setSymptoms(
                event.target.value
              )
            }
            placeholder="For example: headache since yesterday and a mild fever."
            rows="6"
            maxLength={
              MAX_LENGTH
            }
          />


          {/* Tells the user where their words go. Keep it true for the model set in LLM_* on Render. */}
          <p className="field__hint symptoms-ai-notice">
            {simplified
              ? "Nabad's safety rules check this first. Then it is sent over an encrypted connection to Google's Gemini AI service to help check how urgent it is. Emergencies are not sent. Nabad does not keep it in its logs."
              : "Your description is checked by Nabad's safety rules first, then sent over an encrypted connection to Google's Gemini AI service to help assess urgency. Emergencies are not sent to the AI. Nabad doesn't write your description to its logs."}{" "}
            <a href="/privacy#ai-symptom-check">How this works</a>
          </p>

          {symptoms.length >=
            SHOW_COUNT_FROM && (
            <p className="field__hint">
              {symptoms.length} of{" "}
              {MAX_LENGTH}{" "}
              characters
            </p>
          )}


          {speechRecognitionSupported && (
            <div>
              <Button
                variant="secondary"
                onClick={
                  toggleSpeechInput
                }
                aria-pressed={
                  isListening
                }
              >
                {isListening
                  ? "Stop listening"
                  : "Speak symptoms"}
              </Button>
            </div>
          )}


          <p
            role="status"
            aria-live="polite"
            className="field__hint"
          >
            {isListening
              ? simplified
                ? "Listening. Tap stop when finished."
                : "Listening. Describe your symptoms, then stop listening when you are finished."
              : speechError}
          </p>
        </div>


        <div className="form-actions">
          <Button type="submit">
            {simplified
              ? "Check"
              : "Submit symptoms"}
          </Button>
        </div>
      </form>


      {message && (
        <Alert
          tone="success"
          as="p"
          className="symptoms-message"
        >
          {message}
        </Alert>
      )}


      <UrgencyResult
        result={urgency}
        preliminary={
          followUps.length > 0
        }
      />


      {urgency?.level ===
        "emergency" &&
        emergencyContact && (
          <Alert
            tone="danger"
            role="alert"
          >
            <h3>
              Your emergency contact
            </h3>

            <p>
              <strong>
                {emergencyContact.name}
              </strong>
            </p>

            <p>
              {emergencyContact.phone}
            </p>

            <p>
              <a
                href={`tel:${emergencyContactPhone}`}
              >
                Call{" "}
                {emergencyContact.name}
              </a>
            </p>
          </Alert>
        )}


      <FollowUpQuestions
        key={
          assessmentCount
        }
        questions={
          followUps
        }
        onSubmit={
          handleFollowUpSubmit
        }
        onSkip={() =>
          setFollowUps([])
        }
        busy={refining}
      />


      {error && (
        <Alert
          tone="danger"
          as="p"
          className="symptoms-message"
        >
          {error}
        </Alert>
      )}

      <section className="symptom-history section" aria-labelledby="symptom-history-heading">
        <h2 id="symptom-history-heading">Previous symptom checks</h2>
        {history.length === 0 ? <p className="text-muted">Your saved conversations will appear here.</p> : (
          <ul className="symptom-history__list">
            {history.slice(0, 10).map((record) => (
              <li key={record.id}>
                <details>
                  <summary>{record.createdAt ? new Date(record.createdAt).toLocaleString() : "Previous check"} · {record.urgencyResult?.label || "Urgency check"}</summary>
                  <ol aria-label="Saved conversation">
                    {(record.conversation || [
                      { role: "patient", content: record.description },
                      { role: "assistant", content: `${record.urgencyResult?.label || ""}. ${record.urgencyResult?.timeframe || ""}. ${record.urgencyResult?.action || ""}` },
                    ]).map((turn, index) => <li key={`${record.id}-${index}`}><strong>{turn.role === "patient" ? "You" : "Nabad"}:</strong> {turn.content}</li>)}
                  </ol>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageLayout>
  );
}

// Health data: only for signed-in users (see components/RequireSignIn.js).
SymptomsPage.requireSignIn = true;
