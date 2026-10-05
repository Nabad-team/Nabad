import { useEffect, useState } from "react";
import { getEmergencyContact, addEmergencyContact, updateEmergencyContact, removeEmergencyContact } from "../lib/api";
import Dialog from "./Dialog";

// The account's emergency contact. Three views:
//   - no contact yet  -> the add form
//   - contact saved   -> the contact with "Edit" and "Remove" buttons
//   - editing         -> the same form, filled in with the saved values
// Removing asks for confirmation first, because the contact is used during emergency alerts.
export default function EmergencyContact() {
  const [contact, setContact] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

  async function load() {
    setLoading(true); setError(""); setLoadFailed(false);
    try { setContact((await getEmergencyContact()).contact); }
    catch { setLoadFailed(true); setError("Could not load your emergency contact. Make sure you are signed in, then retry."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function startEdit() {
    setName(contact.name); setPhone(contact.phone);
    setError(""); setNotice(""); setEditing(true);
  }
  function cancelEdit() { setEditing(false); setError(""); }

  async function save(event) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (editing) {
        setContact((await updateEmergencyContact(name.trim(), phone)).contact);
        setEditing(false); setNotice("Your emergency contact was updated.");
      } else {
        setContact((await addEmergencyContact(name.trim(), phone)).contact);
      }
    } catch (failure) {
      // 404 on edit: the contact was removed elsewhere (e.g. another tab). Show the add form instead.
      if (editing && failure.status === 404) { setContact(null); setEditing(false); }
      setError(failure.message || "Could not save your emergency contact.");
    } finally { setSaving(false); }
  }

  async function remove() {
    setSaving(true); setError(""); setNotice("");
    try {
      await removeEmergencyContact();
      setContact(null); setName(""); setPhone("");
      setNotice("Your emergency contact was removed.");
    } catch (failure) { setError(failure.message || "Could not remove your emergency contact."); }
    finally { setSaving(false); setConfirmingRemove(false); }
  }

  const inputStyle = { display: "block", width: "100%", padding: 8, margin: "6px 0 16px", boxSizing: "border-box" };
  const primary = { padding: "10px 20px", borderRadius: 8, background: "#0f766e", color: "white", border: 0 };
  const secondary = { padding: "10px 20px", borderRadius: 8, background: "white", color: "#0f766e", border: "1px solid #0f766e", marginLeft: 8 };
  const danger = { padding: "10px 20px", borderRadius: 8, background: "white", color: "#b91c1c", border: "1px solid #b91c1c", marginLeft: 8 };

  const form = (
    <form onSubmit={save}>
      <label htmlFor="emergency-name">Contact name</label>
      <input id="emergency-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} style={inputStyle} />
      <label htmlFor="emergency-phone">Contact phone</label>
      <input id="emergency-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required maxLength={40} placeholder="+961 71 123 456" aria-describedby="emergency-phone-help" style={inputStyle} />
      <p id="emergency-phone-help">Use a Lebanese number or include the international country code.</p>
      <button disabled={saving} type="submit" style={primary}>
        {saving ? "Saving..." : editing ? "Save changes" : "Save emergency contact"}
      </button>
      {editing && <button type="button" onClick={cancelEdit} disabled={saving} style={secondary}>Cancel</button>}
    </form>
  );

  let body;
  if (loading) body = <p role="status">Loading emergency contact...</p>;
  else if (loadFailed) body = <button type="button" onClick={load}>Retry loading contact</button>;
  else if (!contact || editing) body = form;
  else body = (
    <div>
      <div role="status"><p><strong>{contact.name}</strong></p><p>{contact.phone}</p><p>Your emergency contact is saved.</p></div>
      <button type="button" onClick={startEdit} style={{ ...primary }}>Edit contact</button>
      <button type="button" onClick={() => { setNotice(""); setError(""); setConfirmingRemove(true); }} style={danger}>Remove contact</button>
    </div>
  );

  return (
    <section aria-labelledby="emergency-heading" style={{ border: "2px solid #0f766e", borderRadius: 12, padding: 20, marginTop: 40 }}>
      <h2 id="emergency-heading" style={{ marginTop: 0, color: "#0f766e" }}>Emergency contact</h2>
      <p>This contact belongs to your account.</p>
      {body}
      {notice && <p role="status" style={{ color: "#0f766e" }}>{notice}</p>}
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      {confirmingRemove && (
        <Dialog title="Remove emergency contact?">
          <p>{contact?.name} will no longer be shown during emergency alerts. You can add a new contact at any time.</p>
          <button type="button" onClick={remove} disabled={saving} style={{ ...danger, marginLeft: 0 }}>{saving ? "Removing..." : "Yes, remove"}</button>
          <button type="button" onClick={() => setConfirmingRemove(false)} disabled={saving} style={secondary}>Keep contact</button>
        </Dialog>
      )}
    </section>
  );
}
