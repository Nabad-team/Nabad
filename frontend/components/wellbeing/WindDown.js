import { useState } from "react";
import { WIND_DOWN_STEPS } from "../../lib/wellbeingExercises";

// Bedtime wind-down: a short evening checklist. The ticks only live on screen; nothing is saved.
//   sleepHref: where "Log your sleep tomorrow morning" goes (the sleep log on Water and sleep).
export default function WindDown({ id = "wind-down", sleepHref = "/water-and-sleep#sleep-heading" }) {
  const [ticked, setTicked] = useState(() => WIND_DOWN_STEPS.map(() => false));
  return (
    <div className="wind-down">
      <fieldset className="wind-down__list">
        <legend className="visually-hidden">Bedtime wind-down checklist</legend>
        {WIND_DOWN_STEPS.map((step, index) => (
          <label key={step} className="check" htmlFor={`${id}-${index}`}>
            <input id={`${id}-${index}`} type="checkbox" checked={ticked[index]}
              onChange={(event) => setTicked((current) => current.map((value, position) => (position === index ? event.target.checked : value)))} />
            {step}
          </label>
        ))}
      </fieldset>
      <p className="text-muted text-sm">Your ticks aren&apos;t saved.</p>
      <p><a href={sleepHref}>Log your sleep tomorrow morning</a></p>
    </div>
  );
}
