import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import InlinePanel from "../components/ui/InlinePanel";
import BreathingExercise from "../components/wellbeing/BreathingExercise";
import GroundingExercise from "../components/wellbeing/GroundingExercise";
import ResetExercise from "../components/wellbeing/ResetExercise";
import WindDown from "../components/wellbeing/WindDown";
import WellbeingHelp from "../components/wellbeing/WellbeingHelp";
import { EXERCISES, reflectionQuestionFor } from "../lib/wellbeingExercises";

// Wellbeing: the calm exercises, in the My care menu and opened from the dashboard's Wellbeing Corner
// (/wellbeing?start=breathing and so on). The title is the menu label exactly ("One name per page").
// Calm, short, and nothing is saved: no mood, answers, ticks or history. The exercise runs in a panel under the
// header; the support block (140, 1564, when to reach out) sits with it, or at the bottom when no exercise is open,
// so 140 appears once on the page apart from the footer. Never linked from a symptom-check result.
export default function WellbeingPage() {
  const router = useRouter();
  const [open, setOpen] = useState(null);
  const buttons = useRef({});
  const opener = useRef({ current: null });

  // The Wellbeing Corner's buttons open an exercise straight away.
  const start = typeof router?.query?.start === "string" ? router.query.start : "";
  useEffect(() => {
    if (EXERCISES.some((exercise) => exercise.key === start)) setOpen(start);
  }, [start]);

  function openExercise(key) {
    opener.current = { current: buttons.current[key] || null };
    setOpen(key);
  }
  function close() {
    setOpen(null);
    if (start) router.replace?.("/wellbeing", undefined, { shallow: true });
  }

  const exercise = EXERCISES.find((item) => item.key === open);
  const question = reflectionQuestionFor();
  return (
    <PageLayout title="Wellbeing" header={<ProfileHeader />}>
      <PageTitle lead="Short, calm exercises that can help you slow down. Nothing you do here is saved.">Wellbeing</PageTitle>

      {exercise && (
        <InlinePanel key={exercise.key} id={`exercise-${exercise.key}`} title={exercise.title} onClose={close} returnFocusTo={opener.current}>
          {exercise.key === "breathing" && <BreathingExercise />}
          {exercise.key === "grounding" && <GroundingExercise />}
          {exercise.key === "reset" && <ResetExercise onStop={close} />}
          {exercise.key === "wind-down" && <WindDown id="wellbeing-wind-down" />}
          {exercise.key !== "reset" && <div className="button-row exercise__close"><Button variant="secondary" onClick={close}>Close</Button></div>}
          <WellbeingHelp id={`exercise-help-${exercise.key}`} />
        </InlinePanel>
      )}

      <div className="card-grid">
        {EXERCISES.map((item) => (
          <Card key={item.key} aria-labelledby={`card-${item.key}-heading`} className="exercise-card">
            <h2 id={`card-${item.key}-heading`}>{item.title}</h2>
            <p>{item.summary}</p>
            <Button variant="secondary" ref={(element) => { buttons.current[item.key] = element; }}
              onClick={() => openExercise(item.key)} aria-expanded={open === item.key} aria-controls={open === item.key ? `exercise-${item.key}` : undefined}>
              {item.key === "wind-down" ? "Open the checklist" : `Start the ${item.title.charAt(0).toLowerCase()}${item.title.slice(1)}`}
            </Button>
          </Card>
        ))}
        <Card aria-labelledby="reflection-heading" className="card--full">
          <h2 id="reflection-heading">Question of the day</h2>
          <p className="reflection__question">{question}</p>
          <p className="text-muted">Just think about it. Nothing is saved.</p>
        </Card>
        {!exercise && <Card aria-labelledby="page-help-heading" className="card--full"><WellbeingHelp id="page-help" /></Card>}
      </div>
    </PageLayout>
  );
}

WellbeingPage.requireSignIn = true;
