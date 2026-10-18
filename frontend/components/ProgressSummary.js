import { useEffect, useRef, useState } from "react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { getHealthProfile } from "../lib/healthProfileApi";
import { basicsFilled } from "../lib/healthProfile";
import { getToday } from "../lib/wellbeingApi";
import { todayString } from "../lib/dates";
import { hoursText, sleptText, waterCountText } from "../lib/wellbeing";

export default function ProgressSummary() {
  const { activeProfile } = useActiveProfile();
  const profileId = activeProfile?.id;
  const who = activeProfile && !activeProfile.isSelf ? activeProfile.fullName : null;
  const [health, setHealth] = useState(null);
  const [wellbeing, setWellbeing] = useState(null);
  const [healthFailed, setHealthFailed] = useState(false);
  const [wellbeingFailed, setWellbeingFailed] = useState(false);
  const profileRef = useRef(profileId);
  profileRef.current = profileId;

  useEffect(() => {
    if (!profileId) return;
    const requested = profileId;
    setHealth(null); setWellbeing(null); setHealthFailed(false); setWellbeingFailed(false);
    getHealthProfile(requested)
      .then((data) => { if (profileRef.current === requested) setHealth(data); })
      .catch(() => { if (profileRef.current === requested) setHealthFailed(true); });
    getToday(requested, todayString())
      .then((data) => { if (profileRef.current === requested) setWellbeing(data); })
      .catch(() => { if (profileRef.current === requested) setWellbeingFailed(true); });
  }, [profileId]);

  return (
    <Card aria-labelledby="progress-summary-heading" className="section progress-summary">
      <h2 id="progress-summary-heading">Your progress</h2>
      <ul className="progress-summary__list">
        <li>
          <div><h3>My health</h3>{healthFailed ? <p className="text-muted">Progress unavailable.</p> : health ? <p>{basicsFilled(health)} of 5 health basics filled in{who ? ` for ${who}` : ""}.</p> : <p className="text-muted">Loading progress…</p>}</div>
          <Button variant="secondary" href="/my-health">Open my health</Button>
        </li>
        <li>
          <div><h3>Water and sleep</h3>{wellbeingFailed ? <p className="text-muted">Today's progress unavailable.</p> : wellbeing ? <p>Water: {waterCountText(wellbeing.water.totalMl, wellbeing.water.goal)}. Sleep: {wellbeing.sleep ? `${hoursText(wellbeing.sleep.hours)}, ${sleptText(wellbeing.sleep.quality).toLowerCase()}` : "Not logged yet"}.</p> : <p className="text-muted">Loading progress…</p>}</div>
          <Button variant="secondary" href="/water-and-sleep">Open water and sleep</Button>
        </li>
      </ul>
    </Card>
  );
}
