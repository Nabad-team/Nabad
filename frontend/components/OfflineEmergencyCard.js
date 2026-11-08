import { useEffect, useRef, useState } from "react";
import offline from "../public/offline-emergency";
import { factText } from "../lib/healthProfile";
import Button from "./ui/Button";

export default function OfflineEmergencyCard({ card, owner }) {
  const [saved, setSaved] = useState(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const generation = useRef(0);
  useEffect(() => { generation.current++; setMessage(""); setSaving(false); return () => { generation.current++; }; }, [card, owner]);
  useEffect(() => {
    const update = () => setSaved(offline.read());
    update(); window.addEventListener("storage", update); window.addEventListener("nabad-offline-emergency-changed", update);
    return () => { window.removeEventListener("storage", update); window.removeEventListener("nabad-offline-emergency-changed", update); };
  }, []);
  async function save() {
    if (saving) return;
    const current = generation.current;
    let timeout;
    setSaving(true);
    setMessage("");
    try {
      if (!("serviceWorker" in navigator)) throw new Error("unsupported");
      const prepare = async () => {
        const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/", updateViaCache: "none" });
        await registration.update();
        const worker = registration.installing || registration.waiting;
        if (worker && worker.state !== "activated") await new Promise((resolve, reject) => {
          worker.addEventListener("statechange", () => {
            if (worker.state === "activated") resolve();
            if (worker.state === "redundant") reject(new Error("Worker unavailable"));
          });
        });
        await navigator.serviceWorker.ready;
        const cache = await caches.open("nabad-public-help-v2");
        await Promise.all(["/offline.html", "/offline-emergency.js"].map(path => cache.add(new Request(path, { credentials: "omit", cache: "reload" }))));
      };
      await Promise.race([prepare(), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("timeout")), 15000); })]);
      if (generation.current !== current) return;
      offline.save(owner, { ...card,
        conditions: card.conditions.map(value => ({ label: factText({ category: "condition", value }) })),
        medications: card.medications.map(m => ({ name: m.name, dose: m.dose ? [m.dose, m.unit, m.form].filter(Boolean).join(" ") : "", frequency: m.frequency })),
      });
      setMessage("Emergency information saved for offline use. Open emergency help to check it.");
    } catch { if (generation.current === current) setMessage("Could not save offline information. Check your connection and browser storage, then try again."); }
    finally { clearTimeout(timeout); if (generation.current === current) setSaving(false); }
  }
  return <section aria-label="Offline emergency information" className="section">
    <h2>Use without internet</h2>
    <p>Save one emergency card on this device. Anyone using this browser can view it without signing in. Use a trusted personal device. Saving replaces the previous copy; updates are not automatic. Signing out or ending your session removes it.</p>
    {saved && <p>Saved copy: {saved.card.profile.fullName}. Saved {new Date(saved.savedAt).toLocaleString("en-GB")}.</p>}
    <div className="button-row">
      <Button disabled={!card || !owner || saving} onClick={save}>{saving ? "Saving offline copy..." : "Save for offline use"}</Button>
      <Button variant="secondary" href="/offline.html">Open emergency help</Button>
      {saved && <Button variant="secondary" onClick={() => { try { offline.clear(); setMessage("Saved emergency information removed."); } catch { setMessage("Could not remove the saved copy. Clear this site's data in browser settings."); } }}>Remove offline copy</Button>}
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}
