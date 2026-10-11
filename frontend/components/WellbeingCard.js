import { useEffect, useRef, useState } from "react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { getToday } from "../lib/wellbeingApi";
import { todayString } from "../lib/dates";
import { hoursText, sleptText, waterCountText } from "../lib/wellbeing";

// The dashboard's "Water and sleep" card: today's glasses and last night's sleep for the active profile.
export default function WellbeingCard() {
  const { activeProfile } = useActiveProfile();
  const profileId = activeProfile?.id;
  const [today, setToday] = useState(null);
  const [failed, setFailed] = useState(false);
  const profileRef = useRef(profileId);
  profileRef.current = profileId;

  useEffect(() => {
    if (!profileId) return;
    const requested = profileId;
    setToday(null); setFailed(false);
    getToday(requested, todayString())
      .then((data) => { if (profileRef.current === requested) setToday(data); })
      .catch(() => { if (profileRef.current === requested) setFailed(true); });
  }, [profileId]);

  return (
    <Card aria-labelledby="wellbeing-card-heading" className="section">
      <h2 id="wellbeing-card-heading">Water and sleep</h2>
      {failed && <p className="text-muted">We couldn't load today's water and sleep.</p>}
      {today && (
        <div className="details">
          <p><span className="details__label">Water today</span>{waterCountText(today.water.glasses, today.water.target)}</p>
          <p>
            <span className="details__label">Last night</span>
            {today.sleep ? `${hoursText(today.sleep.hours)}, ${sleptText(today.sleep.quality).toLowerCase()}` : "Not logged yet"}
          </p>
        </div>
      )}
      <Button variant="secondary" href="/water-and-sleep">Open water and sleep</Button>
    </Card>
  );
}
