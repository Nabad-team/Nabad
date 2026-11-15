import { useEffect, useRef, useState } from "react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Alert from "./ui/Alert";
import NextStepCard from "./NextStepCard";
import { NextStepSkeleton } from "./ui/Skeleton";
import { getMe, hideGettingStarted } from "../lib/api";
import { allDone, doneCount, gettingStartedSteps, progressText } from "../lib/gettingStarted";

// The dashboard's "Getting started" card: four first steps for the profile being viewed, each with one button,
// ticked from data the dashboard already loads (lib/gettingStarted.js). "2 of 4 done" in words. Calm: no streaks,
// no pressure, and "Hide" turns it off for good for the account (stored on the server).
export function GettingStartedCard({ steps, forName, onHide, hiding }) {
  const done = doneCount(steps);
  return (
    <Card className="getting-started" aria-labelledby="getting-started-heading">
      <div className="getting-started__header">
        <div>
          <h2 id="getting-started-heading">Getting started</h2>
          <p className="text-muted">{forName ? `A few first steps for ${forName}, whenever you're ready.` : "A few first steps, whenever you're ready."}</p>
        </div>
        <Button variant="secondary" size="small" onClick={onHide} disabled={hiding} aria-describedby="getting-started-hide-hint">Hide</Button>
      </div>
      <p id="getting-started-hide-hint" className="visually-hidden">Hides this card for good. Every page stays in the menu.</p>
      <p className="getting-started__progress">
        <strong>{progressText(steps)}</strong>
        <span className="getting-started__bar" aria-hidden="true"><span style={{ width: `${(done / steps.length) * 100}%` }} /></span>
      </p>
      <ol className="getting-started__steps">
        {steps.map((step) => (
          <li key={step.key} className={`getting-started__step${step.done ? " getting-started__step--done" : ""}`}>
            <span className="getting-started__mark" aria-hidden="true">{step.done ? "✓" : ""}</span>
            <div className="getting-started__text">
              <p className="getting-started__title">{step.done && <span className="visually-hidden">Done: </span>}{step.text}</p>
              {!step.done && <p className="text-muted text-sm">{step.hint}</p>}
            </div>
            {step.done ? <span className="getting-started__done" aria-hidden="true">Done</span>
              : <Button variant="secondary" size="small" href={step.href}>{step.action}</Button>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

// The slot under the page title: the Getting started card while it applies, otherwise the Next step card, never
// both. Until every source has answered it holds the Next step placeholder, so nothing jumps.
//   data: useDashboardData()   forName: the linked profile's first name, "" for your own   isSelf: your own profile
export default function DashboardFirstSteps({ data, forName = "", isSelf = true, now }) {
  const [hidden, setHidden] = useState(null); // null while asking the server
  const [hiding, setHiding] = useState(false);
  const [error, setError] = useState("");
  const savedDone = useRef(false);

  useEffect(() => {
    let active = true;
    getMe()
      .then(({ user }) => { if (active) setHidden(Boolean(user.gettingStartedHidden)); })
      // If the account can't be read, stay with the Next step card rather than guess.
      .catch(() => { if (active) setHidden(true); });
    return () => { active = false; };
  }, []);

  const ready = Boolean(data?.loaded && data?.startLoaded) && hidden !== null;
  const sourcesOk = data && !data.healthFailed && !data.medicationsFailed && !data.symptomsFailed && !data.emergencyCardFailed;
  const steps = ready && sourcesOk ? gettingStartedSteps(data, forName) : null;
  const finished = Boolean(steps && allDone(steps));

  // All four done on your own profile: remember it, so the card stays gone even if something is removed later.
  useEffect(() => {
    if (!finished || !isSelf || hidden || savedDone.current) return;
    savedDone.current = true;
    hideGettingStarted().catch(() => { savedDone.current = false; });
  }, [finished, isSelf, hidden]);

  async function hide() {
    setError("");
    setHiding(true);
    try {
      await hideGettingStarted();
      setHidden(true);
      // The card is gone: put focus somewhere sensible instead of on nothing.
      const title = document.querySelector("main h1");
      if (title) { title.setAttribute("tabindex", "-1"); title.focus(); }
    } catch {
      setError("We couldn't hide the card. Please try again.");
    } finally {
      setHiding(false);
    }
  }

  if (!data) return null;
  if (!ready) return <div className="skeleton" aria-hidden="true"><NextStepSkeleton /></div>;
  if (!hidden && steps && !finished) {
    return (
      <>
        {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
        <GettingStartedCard steps={steps} forName={forName} onHide={hide} hiding={hiding} />
      </>
    );
  }
  return <NextStepCard data={data} forName={forName} now={now} />;
}
