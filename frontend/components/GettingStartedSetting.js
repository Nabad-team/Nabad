import { useEffect, useState } from "react";
import Button from "./ui/Button";
import Alert from "./ui/Alert";
import { getMe, showGettingStarted } from "../lib/api";

// In My profile's Account owner card: only while the dashboard's Getting started card is hidden for the account
// (by "Hide", or by finishing all four steps), a way to bring it back. Steps already done still show as done.
export default function GettingStartedSetting() {
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getMe().then(({ user }) => { if (active) setHidden(Boolean(user.gettingStartedHidden)); }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function show() {
    setBusy(true); setError("");
    try {
      await showGettingStarted();
      setHidden(false);
      setMessage("Getting started will show on your dashboard again.");
    } catch {
      setError("We couldn't change that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (message) return <Alert tone="success" as="p" role="status" className="getting-started-setting">{message} <a href="/dashboard">Go to the dashboard</a></Alert>;
  if (!hidden) return null;
  return (
    <div className="getting-started-setting">
      <p className="text-muted text-sm">The Getting started card on your dashboard is hidden.</p>
      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      <Button variant="secondary" size="small" onClick={show} disabled={busy}>Show getting started again</Button>
    </div>
  );
}
