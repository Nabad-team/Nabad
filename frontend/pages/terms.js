import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Alert from "../components/ui/Alert";

// The Terms of Use, with the medical disclaimer first. Public: linked from the footer and from sign-up.
export default function TermsOfUse() {
  return (
    <PageLayout title="Terms of Use">
      <PageTitle lead="The rules for using Nabad, and what it can and cannot do for your health.">
        Terms of Use
      </PageTitle>

      <p>
        <strong>Last updated:</strong> October 18, 2026
      </p>

      <Alert tone="danger" title="In an emergency, call 140 now." className="page-alert">
        <p>
          Don&apos;t wait for Nabad. Call 140 (Lebanese Red Cross) or go to the nearest emergency department.
        </p>
      </Alert>

      <h2 id="medical-disclaimer">Medical disclaimer</h2>
      <ul>
        <li>
          Nabad gives general guidance only. It does not diagnose illness, prescribe treatment or give
          medical advice.
        </li>
        <li>
          Nabad is not a substitute for a doctor. Always ask a qualified health professional about a medical
          condition, and never ignore or delay professional advice because of something Nabad said.
        </li>
        <li>
          If you think you or someone else may be having a medical emergency, call 140 immediately.
        </li>
      </ul>

      <h2 id="ai">The AI can make mistakes</h2>
      <p>
        Parts of Nabad, such as the symptom check and the health assistant, use AI. AI answers can be wrong,
        incomplete or out of date, even when they sound confident. Nabad&apos;s own safety rules set the
        minimum urgency of a symptom check, but no check is perfect. Use your own judgement, and when in
        doubt, get medical help.
      </p>

      <h2 id="student-project">A student project</h2>
      <p>
        Nabad was built by Team 3 for CMPS 271 at the American University of Beirut. It is a prototype, not
        a certified medical device or a production healthcare service. It may change, have errors or be
        unavailable at any time, and it is provided as is, without any guarantee.
      </p>

      <h2 id="acceptable-use">Acceptable use</h2>
      <p>When you use Nabad, you agree to:</p>
      <ul>
        <li>Give accurate information, and only add people you are allowed to care for as linked profiles.</li>
        <li>Keep your password private and sign out on shared devices.</li>
        <li>Not try to access other people&apos;s accounts or data.</li>
        <li>Not try to break, overload or get around the security of the site.</li>
        <li>Not use Nabad for anything unlawful, or to upload content that isn&apos;t yours to share.</li>
      </ul>
      <p>Accounts that break these rules may be suspended or deleted.</p>

      <h2 id="privacy">Your data</h2>
      <p>
        How Nabad stores and uses your information is explained in the <a href="/privacy">Privacy Policy</a>.
        You can delete your account at any time from your profile.
      </p>

      <h2 id="changes">Changes and questions</h2>
      <p>
        These terms may be updated as the project changes; the date above shows the latest version. Questions
        or problems? <a href="/contact">Contact the team</a>.
      </p>
    </PageLayout>
  );
}
