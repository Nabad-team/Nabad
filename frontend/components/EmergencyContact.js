import { useEffect, useState } from "react";
import { getEmergencyContact, addEmergencyContact, updateEmergencyContact, removeEmergencyContact } from "../lib/api";
import Dialog from "./Dialog";
import Alert from "./ui/Alert";
import Button from "./ui/Button";
import Input from "./ui/Input";
import { HeartbeatLoader } from "./ui/Heartbeat";

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

  const form = (
    <form onSubmit={save} className="form">
      <Input id="emergency-name" label="Contact name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} />
      <Input id="emergency-phone" label="Contact phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required maxLength={40} placeholder="+961 71 123 456" hint="Use a Lebanese number or include the international country code." />
      <div className="form-actions">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : editing ? "Save changes" : "Save emergency contact"}
        </Button>
        {editing && <Button variant="secondary" onClick={cancelEdit} disabled={saving}>Cancel</Button>}
      </div>
    </form>
  );

  let body;
  if (loading) body = <HeartbeatLoader label="Loading emergency contact..." />;
  else if (loadFailed) body = <Button variant="secondary" onClick={load}>Retry loading contact</Button>;
  else if (!contact || editing) body = form;
  else body = (
    <div>
      <div role="status" className="details">
        <p><span className="details__label">Name</span><strong>{contact.name}</strong></p>
        <p><span className="details__label">Phone</span>{contact.phone}</p>
        <p className="text-muted">Your emergency contact is saved.</p>
      </div>
      <div className="button-row">
        <Button variant="secondary" onClick={startEdit}>Edit contact</Button>
        <Button variant="secondary" onClick={() => { setNotice(""); setError(""); setConfirmingRemove(true); }}>Remove contact</Button>
      </div>
    </div>
  );

  return (
    <section aria-labelledby="emergency-heading" className="section">
      <h2 id="emergency-heading">Emergency contact</h2>
      <p className="text-muted">The person we show during an emergency alert. This contact belongs to your account.</p>
      {body}
      {notice && <Alert tone="success" as="p" role="status" className="card__message">{notice}</Alert>}
      {error && <Alert tone="danger" as="p" role="alert" className="card__message">{error}</Alert>}
      {confirmingRemove && (
        <Dialog title="Remove emergency contact?">
          <p>{contact?.name} will no longer be shown during emergency alerts. You can add a new contact at any time.</p>
          <div className="button-row">
            <Button onClick={remove} disabled={saving}>{saving ? "Removing..." : "Yes, remove"}</Button>
            <Button variant="secondary" onClick={() => setConfirmingRemove(false)} disabled={saving}>Keep contact</Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
