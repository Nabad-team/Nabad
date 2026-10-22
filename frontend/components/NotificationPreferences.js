import { useEffect, useState } from "react";
import Alert from "./ui/Alert";
import { NOTIFICATION_TYPES, getNotificationPreferences, updateNotificationPreferences } from "../lib/notificationApi";

// Which notifications the user gets in the app, one switch per type. Each change is saved straight away.
// Emergency alerts and urgent caregiver alerts are always on: they are shown checked and can't be changed.
export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState(null);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getNotificationPreferences()
      .then(setPreferences)
      .catch(() => setError("We couldn't load your notification settings. Please refresh the page."));
  }, []);

  async function change(type, enabled) {
    setMessage(""); setError(""); setSaving(type);
    const previous = preferences;
    setPreferences(preferences.map((item) => (item.type === type ? { ...item, enabled } : item)));
    try {
      setPreferences(await updateNotificationPreferences({ [type]: enabled }));
      setMessage("Notification settings saved.");
    } catch {
      setPreferences(previous);
      setError("We couldn't save that change. Please try again.");
    } finally {
      setSaving("");
    }
  }

  const byType = new Map((preferences || []).map((item) => [item.type, item]));
  return (
    <section className="section notification-preferences" aria-labelledby="notifications-heading">
      <h2 id="notifications-heading">Notifications</h2>
      <p>Choose which notifications Nabad shows you in the app, in the bell at the top of the page and on <a href="/notifications">Notifications</a>.</p>
      {message && <Alert tone="success" as="p" role="status">{message}</Alert>}
      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      {preferences && (
        <fieldset className="form notification-preferences__list">
          <legend className="visually-hidden">Notification types</legend>
          {NOTIFICATION_TYPES.filter(({ type }) => byType.has(type)).map(({ type, label, hint }) => {
            const { enabled, alwaysOn } = byType.get(type);
            const id = `notify-${type}`;
            return (
              <div key={type} className="notification-preferences__item">
                <label className="check" htmlFor={id}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={enabled}
                    // Always-on types stay teal and focusable (so the reason can be read), but never change.
                    aria-disabled={alwaysOn || undefined}
                    disabled={saving === type}
                    aria-describedby={`${id}-hint`}
                    onChange={(event) => { if (!alwaysOn) change(type, event.target.checked); }}
                  />
                  <span>{label}</span>
                  {alwaysOn && <span className="badge">Always on</span>}
                </label>
                <p id={`${id}-hint`} className="field__hint">
                  {hint}{alwaysOn && " These can't be turned off, for your safety."}
                </p>
              </div>
            );
          })}
        </fieldset>
      )}
    </section>
  );
}
