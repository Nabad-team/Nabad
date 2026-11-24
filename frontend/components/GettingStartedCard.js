import { useEffect, useRef, useState } from "react";
import NextStepCard from "./NextStepCard";
import { NextStepSkeleton } from "./ui/Skeleton";
import { getMe, hideGettingStarted } from "../lib/api";
import { allDone, gettingStartedSteps } from "../lib/gettingStarted";

// Getting started: four first steps for the profile being viewed, ticked from data the dashboard already loads
// (lib/gettingStarted.js). They show as "To do" tags on the dashboard's Your health tiles (the YourHealth component),
// with "2 of 4 done" in words. Calm: no streaks, no pressure, and "Hide" turns them off for good for the account
// (stored on the server).

// Which applies: the first steps (To do tags on Your health) while they apply, otherwise the Next step card, never
// both. Until every source has answered, `ready` is false (hold a placeholder, so nothing jumps).
//   data: useDashboardData()   forName: the linked profile's first name, "" for your own   isSelf: your own profile
export function useFirstSteps({ data, forName = "", isSelf = true }) {
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
      // The Hide button is gone: put focus somewhere sensible instead of on nothing.
      const title = document.querySelector("main h1");
      if (title) { title.setAttribute("tabindex", "-1"); title.focus(); }
    } catch {
      setError("We couldn't hide the first steps. Please try again.");
    } finally {
      setHiding(false);
    }
  }

  return { ready, steps, showStart: Boolean(ready && !hidden && steps && !finished), error, hide, hiding };
}

// The Next step card when Getting started doesn't apply; its placeholder until every source has answered.
export function NextStepSlot({ firstSteps, data, forName = "", now }) {
  if (!data) return null;
  if (!firstSteps.ready) return <div className="skeleton" aria-hidden="true"><NextStepSkeleton /></div>;
  if (firstSteps.showStart) return null;
  return <NextStepCard data={data} forName={forName} now={now} />;
}
