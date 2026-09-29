import { useEffect, useState } from "react";
import { getEmergencyContact, addEmergencyContact } from "../lib/api";

export default function EmergencyContact() {
  const [contact, setContact] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  async function load() {
    setLoading(true); setError(""); setLoadFailed(false);
    try { setContact((await getEmergencyContact()).contact); }
    catch { setLoadFailed(true); setError("Could not load your emergency contact. Make sure you are signed in, then retry."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function save(event) {
    event.preventDefault(); setSaving(true); setError("");
    try { setContact((await addEmergencyContact(name.trim(), phone)).contact); }
    catch (failure) { setError(failure.message || "Could not save your emergency contact."); }
    finally { setSaving(false); }
  }
  const inputStyle = { display: "block", width: "100%", padding: 8, margin: "6px 0 16px", boxSizing: "border-box" };
  return (
    <section aria-labelledby="emergency-heading" style={{ border: "2px solid #0f766e", borderRadius: 12, padding: 20, marginTop: 40 }}>
      <h2 id="emergency-heading" style={{ marginTop: 0, color: "#0f766e" }}>Emergency contact</h2>
      <p>This contact belongs to your account.</p>
      {loading ? <p role="status">Loading emergency contact...</p> : contact ? (
        <div role="status"><p><strong>{contact.name}</strong></p><p>{contact.phone}</p><p>Your emergency contact is saved.</p></div>
      ) : !loadFailed ? (
        <form onSubmit={save}>
          <label htmlFor="emergency-name">Contact name</label>
          <input id="emergency-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} style={inputStyle} />
          <label htmlFor="emergency-phone">Contact phone</label>
          <input id="emergency-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required maxLength={40} placeholder="+961 71 123 456" aria-describedby="emergency-phone-help" style={inputStyle} />
          <p id="emergency-phone-help">Use a Lebanese number or include the international country code.</p>
          <button disabled={saving} type="submit" style={{ padding: "10px 20px", borderRadius: 8, background: "#0f766e", color: "white", border: 0 }}>{saving ? "Saving..." : "Save emergency contact"}</button>
        </form>
      ) : <button type="button" onClick={load}>Retry loading contact</button>}
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    </section>
  );
}
