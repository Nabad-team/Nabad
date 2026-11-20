import Card from "./ui/Card";

// SCRUM-343: "Privacy at a glance" in My profile: what Nabad stores, what goes to the AI and what does not, and how
// to export or delete it. A short summary of the Privacy Policy (pages/privacy.js) in plain words; when what is sent
// to the AI changes (backend/src/triage, reports, prescriptionReader.js, historyQuestions.js), change both.
export const AI_USES = [
  ["Symptom check", "what you describe and your answers to follow-up questions, the My health summary of the person the check is for (age, sex, pregnancy, conditions, allergies, current medicines, recent water and sleep) and up to three earlier checks. If the safety rules find an emergency, nothing is sent."],
  ["Health assistant", "your question, the recent messages of that conversation and any report you attach, after you confirm."],
  ["Prescription photo", "the photo or PDF you choose, after you agree. Nothing is saved until you check the medicines."],
  ["Ask about my history", "your question and the matching records, only if you tick “Let AI write the answer”."],
];

export default function PrivacyAtAGlance() {
  return (
    <Card className="card--full privacy-glance" aria-labelledby="privacy-glance-heading">
      <h2 id="privacy-glance-heading">Privacy at a glance</h2>
      <p className="text-muted">How Nabad handles your information, in short. The <a href="/privacy">Privacy Policy</a> has the details.</p>

      <div className="privacy-glance__grid">
        <section aria-labelledby="privacy-glance-stores">
          <h3 id="privacy-glance-stores">What Nabad stores</h3>
          <ul>
            <li>Your account: name, email, phone, date of birth, picture and emergency contact.</li>
            <li>For you and each person you look after: symptom checks and their conversations, My health, medicines and reminders, appointments, vitals, water and sleep, documents and ID or insurance files, visit sheets, questions for the doctor, links you share with a doctor, and health assistant conversations you keep.</li>
            <li>Your care circle: the people you invite. They only ever see your name, how urgent a check was, and your phone number.</li>
          </ul>
          <p className="text-sm text-muted">It is kept in Nabad&apos;s database, with encrypted backups for about 35 days. Nabad&apos;s logs and error reports never contain your health details.</p>
        </section>

        <section aria-labelledby="privacy-glance-ai">
          <h3 id="privacy-glance-ai">What goes to the AI</h3>
          <p>Only when you use one of these, over an encrypted connection to Google&apos;s Gemini AI service:</p>
          <ul>
            {AI_USES.map(([feature, sent]) => <li key={feature}><strong>{feature}:</strong> {sent}</li>)}
          </ul>
        </section>

        <section aria-labelledby="privacy-glance-not-ai">
          <h3 id="privacy-glance-not-ai">What never goes to the AI</h3>
          <ul>
            <li>Your name, email, phone number and date of birth (the AI only sees an age).</li>
            <li>Your emergency contact, your care circle and your location.</li>
            <li>The files in My documents and your ID or insurance files. Only a report you attach yourself in the health assistant is sent.</li>
            <li>Your vitals, your health story, visit sheets, questions for the doctor and links you share with a doctor.</li>
          </ul>
          <p className="text-sm text-muted">If you tick &ldquo;Let AI write the answer&rdquo; in Ask about my history, a matching document&apos;s name, type and date can be sent, never the file.</p>
        </section>

        <section aria-labelledby="privacy-glance-control">
          <h3 id="privacy-glance-control">Export or delete</h3>
          <ul>
            <li><a href="#data-export-heading">Download my data</a>: one file with everything above, for you and the people you look after.</li>
            <li>Delete a single record on its own page, or revoke a doctor link in Visit preparation.</li>
            <li>Removing a linked profile deletes all of that person&apos;s data.</li>
            <li><a href="#danger-heading">Delete my account</a>: removes your account, every linked profile and all their data. Backups expire within about 35 days.</li>
          </ul>
        </section>
      </div>
    </Card>
  );
}
