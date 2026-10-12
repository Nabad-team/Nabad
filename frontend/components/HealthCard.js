import { useEffect, useRef, useState } from "react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { getHealthProfile } from "../lib/healthProfileApi";
import { basicsFilled, knowsYouText } from "../lib/healthProfile";

// The dashboard's "My health" card: how many basics are filled in for the active profile, and the way in.
export default function HealthCard() {
  const { activeProfile } = useActiveProfile();
  const profileId = activeProfile?.id;
  const who = activeProfile && !activeProfile.isSelf ? activeProfile.fullName : null;
  const [profile, setProfile] = useState(null);
  const [failed, setFailed] = useState(false);
  const profileRef = useRef(profileId);
  profileRef.current = profileId;

  useEffect(() => {
    if (!profileId) return;
    const requested = profileId;
    setProfile(null); setFailed(false);
    getHealthProfile(requested)
      .then((data) => { if (profileRef.current === requested) setProfile(data); })
      .catch(() => { if (profileRef.current === requested) setFailed(true); });
  }, [profileId]);

  return (
    <Card aria-labelledby="health-card-heading" className="section">
      <h2 id="health-card-heading">My health</h2>
      <p>Conditions, allergies and the basics, so Nabad can give {who ? `${who} ` : "you "}safer guidance.</p>
      {failed && <p className="text-muted">We couldn't load this health information.</p>}
      {profile && <p className="text-muted">{knowsYouText(basicsFilled(profile), who)}</p>}
      <Button variant="secondary" href="/my-health">Open my health</Button>
    </Card>
  );
}
