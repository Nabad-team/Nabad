import { useState } from "react";
import Input from "./ui/Input";
import Button from "./ui/Button";
import Alert from "./ui/Alert";
import { confirmDataExport, downloadDataExport } from "../lib/dataExportApi";

// "Download my data" on the profile page: explains what the file holds, asks the user to confirm it's them
// (password, or email for Google-only accounts), then downloads nabad-data-YYYY-MM-DD.json.
export default function DataExport({ isGoogleAccount = false }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [credential, setCredential] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function open() {
    setCredential("");
    setMessage("");
    setError("");
    setIsConfirming(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!credential.trim()) {
      setError(isGoogleAccount ? "Enter your email to confirm it's you." : "Enter your password to confirm it's you.");
      return;
    }
    setError("");
    setWorking(true);
    try {
      await confirmDataExport(credential, { google: isGoogleAccount });
      const fileName = await downloadDataExport();
      setIsConfirming(false);
      setCredential("");
      setMessage(`Your data was downloaded as ${fileName}. We've emailed you to let you know.`);
    } catch (err) {
      // e.g. "Password is incorrect." or the hourly limit. A network failure has no message from the API.
      setError(err.status ? err.message : "We couldn't download your data. Please check your connection and try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="section" aria-labelledby="data-export-heading">
      <h2 id="data-export-heading">Download my data</h2>
      <p>Get a copy of everything Nabad stores about your account, in one file you can keep or take elsewhere. It includes:</p>
      <ul>
        <li>Your account details, emergency contact and notification settings</li>
        <li>Your linked family profiles</li>
        <li>For you and each linked profile: medications and check-ins, My health, water and sleep, symptom checks, appointments, health assistant conversations and notifications</li>
        <li>Your favorite providers and your care circle</li>
      </ul>
      <p className="text-muted">
        The file is in JSON format. It never includes your password or sign-in security details, or anyone else's health information.
        Keep it somewhere safe: it contains your health information.
      </p>

      {message && <Alert tone="success" as="p" role="status">{message}</Alert>}

      {!isConfirming && <Button variant="secondary" onClick={open}>Download my data</Button>}

      {isConfirming && (
        <form onSubmit={handleSubmit} noValidate className="form">
          {/* Google-only accounts have no password, so they type their email instead (like deleting the account). */}
          <Input
            id="dataExportCredential"
            label={isGoogleAccount ? "Email" : "Password"}
            hint="For your security, confirm it's you. We'll email you after the download."
            type={isGoogleAccount ? "email" : "password"}
            autoComplete={isGoogleAccount ? "email" : "current-password"}
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            autoFocus
          />
          {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
          <div className="form-actions">
            <Button type="submit" disabled={working}>{working ? "Preparing your file..." : "Confirm and download"}</Button>
            <Button variant="secondary" onClick={() => setIsConfirming(false)} disabled={working}>Cancel</Button>
          </div>
        </form>
      )}
    </section>
  );
}
