import Link from "next/link";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";

export default function PrivacyPolicy() {
  return (
    <PageLayout
      title="Privacy Policy"
      variant="prose"
      footer={
        <p>
          Nabad is a student software project. This page explains how data is
          handled in the current prototype.
        </p>
      }
    >
      <PageTitle lead="How Nabad handles your personal and health information.">
        Privacy Policy
      </PageTitle>

      <p>
        <strong>Last updated:</strong> October 28, 2026
      </p>

      <h2>Information Nabad stores</h2>

      <p>
        Nabad may store information that you choose to provide, including:
      </p>

      <ul>
        <li>Account and profile information</li>
        <li>Emergency contact information</li>
        <li>Linked profile information</li>
        <li>Your care circle: the email addresses you invite and the people who join</li>
        <li>Symptoms entered into the application</li>
        <li>Saved symptom-check conversations and follow-up answers</li>
        <li>Health assistant conversations and report explanations you choose to save</li>
        <li>Medications and other saved health information</li>
        <li>Wellbeing information that you choose to save</li>
      </ul>

      <h2>How symptom information is used</h2>

      <p>
        When you submit symptoms, the symptom description is sent over an
        encrypted connection to Nabad&apos;s symptom-assessment service so the
        application can estimate how urgently you may need care.
      </p>

      <p>
        The symptom description and resulting urgency assessment can then be
        stored in your Nabad account for the selected profile, together with
        the follow-up conversation so you can review earlier checks.
      </p>

      <h2 id="ai-symptom-check">AI in the symptom check</h2>

      <p>
        Nabad&apos;s own safety rules check every symptom description first.
        They always set the minimum urgency, and the AI can only make the result
        more cautious, never less.
      </p>

      <ul>
        <li>
          Unless the safety rules already found an emergency, your description
          and any follow-up answers you choose are sent over an encrypted
          connection to Google&apos;s Gemini AI service to help assess urgency.
        </li>
        <li>
          For a non-emergency check, the My health summary of the person the
          check is for is sent with it: their age, sex, pregnancy, long-term
          conditions, allergies, current medicines and any recent water and
          sleep log. It is exactly the text shown under &quot;What Nabad&apos;s
          guidance takes into account&quot; on the My health page, so you can
          see and change it there. Nabad&apos;s safety rules also use it, so
          the symptom check doesn&apos;t ask again what My health already says.
        </li>
        <li>
          For a non-emergency check, up to three earlier saved symptom checks
          for the same profile may also be sent as historical context. Past
          symptoms are identified as history and are not assumed to be current.
        </li>
        <li>
          If the safety rules find an emergency, the result is shown straight
          away and your description is not sent to the AI.
        </li>
        <li>
          Your name, email, date of birth and account details are not sent
          with your description. The My health summary gives an age, not a
          date of birth.
        </li>
        <li>
          Nabad does not write your description or the AI&apos;s reply to its
          logs. They only record that a check happened and whether the AI was
          used.
        </li>
        <li>
          If the AI is unavailable, the safety rules give the result on their
          own.
        </li>
      </ul>

      <h2 id="ai-health-assistant">AI in the health assistant</h2>

      <p>
        The health assistant answers health questions and explains written test
        reports. You confirm before anything is sent.
      </p>

      <ul>
        <li>
          Your question, the recent messages in the conversation and any report
          you attach are sent over an encrypted connection to Google&apos;s
          Gemini AI service to write the answer or the report review.
        </li>
        <li>
          Your name, email and profile details are not sent with your question.
        </li>
        <li>
          Nabad saves your conversation messages, AI replies, and report
          findings to the selected profile for later review. Uploaded files
          themselves are not stored. You can delete saved conversations from
          the health assistant.
        </li>
        <li>
          Nabad does not write your messages, files or the AI&apos;s reply to
          its logs. Logs only record that a request happened and whether it
          succeeded.
        </li>
      </ul>

      <h2>Who can access your information</h2>

      <p>
        Health information is available through an authenticated Nabad account.
        Linked profiles can only be accessed by the account that owns them.
      </p>

      <h2 id="care-circle">Your care circle</h2>

      <p>
        You can invite people you trust to your care circle. When one of your
        symptom checks, or a check for one of your linked profiles, comes out
        urgent or an emergency, Nabad tells them in the app and by email.
      </p>

      <p>People in your care circle can see:</p>

      <ul>
        <li>Your name, and the name of the linked profile the check was for</li>
        <li>How urgent the check was (urgent or emergency) and when it happened</li>
        <li>Your phone number, if you saved one on your profile, so they can call you</li>
      </ul>

      <p>
        They can never see your symptoms, your follow-up answers, the advice
        Nabad gave, or any other health information, and they can't open your
        account or your linked profiles. You can remove someone from your care
        circle, and anyone can leave a care circle, at any time. Invitations
        expire after 7 days, and Nabad never tells you whether an invited email
        address has a Nabad account.
      </p>

      <h2>Services Nabad uses</h2>

      <p>Nabad currently uses the following services:</p>

      <ul>
        <li>
          <strong>Vercel</strong> to host the Nabad website.
        </li>
        <li>
          <strong>Render</strong> to host the Nabad server.
        </li>
        <li>
          <strong>MongoDB Atlas</strong> to store application data.
        </li>
        <li>
          <strong>Brevo</strong> to send account-related emails, care circle
          invitations and care circle alerts.
        </li>
        <li>
          <strong>Google</strong> for Google sign-in when that option is used.
        </li>
        <li>
          <strong>OpenStreetMap</strong> map data for healthcare provider maps.
        </li>
        <li>
          <strong>Google Gemini</strong> AI service for the symptom check, the
          health assistant and report review.
        </li>
        <li>
          <strong>Sentry</strong> to receive error reports when something goes
          wrong in Nabad, so the team can fix it.
        </li>
      </ul>

      <h2>Logs and health information</h2>

      <p>
        Nabad is designed so that symptom descriptions and other health data are
        not written to application logs.
      </p>

      <h2 id="error-reports">Error reports</h2>

      <p>
        When something breaks in Nabad, an error report is sent to Sentry so the
        team is alerted and can fix it. Error reports never contain personal or
        health information.
      </p>

      <ul>
        <li>
          A report only says what kind of error happened, where in Nabad&apos;s
          code and on which page, the error code, and a reference number that
          matches Nabad&apos;s own logs.
        </li>
        <li>
          It never includes your symptoms or other health information, what you
          typed, your name, email address, IP address, cookies or sign-in
          details, or the full web address of the page.
        </li>
        <li>
          Nabad does not record your screen or your clicks and typing for error
          reports.
        </li>
      </ul>

      <h2 id="usage-statistics">Anonymous usage statistics</h2>

      <p>
        Nabad counts completed symptom assessments and follow-up requests in
        daily totals to understand how the service is used. These counters do
        not contain your account or profile ID, symptoms, urgency level,
        location, IP address, cookies or individual activity history. They are
        kept for up to 90 days and are not sent to an advertising or analytics
        service. A resubmitted initial check is counted as another request.
      </p>

      <h2>Offline emergency help</h2>

      <p>
        After a successful online visit, a public emergency-help page may be
        stored on your device for connection failures. It contains no personal
        or medical information. Nabad does not cache your account pages, health
        records or API responses for offline use. Internet access is still
        required to load or save your information and run symptom checks.
      </p>

      <h2>Account security</h2>

      <p>
        Nabad uses a sign-in cookie to keep you signed in. The application also
        signs users out after 30 minutes of inactivity to reduce the risk of
        someone accessing health information on an unattended device.
      </p>

      <p>
        You should still protect your password and sign out when using a shared
        or public device.
      </p>

      <h2>Emergency information</h2>

      <p>
        Nabad may display your saved emergency contact and emergency phone
        numbers when urgent help may be needed so that you can quickly contact
        emergency services or someone you trust.
      </p>

      <h2>Your choices and deleting your data</h2>

      <p>
        You can update information stored in your profile and remove supported
        health records from within Nabad.
      </p>

      <p>
        You can also delete your account from the profile page. Account deletion
        removes the account and its associated stored data, including data for
        linked profiles, your care circle and your place in other people's
        care circles.
      </p>

      <h2 id="download-your-data">Your right to a copy of your data</h2>

      <p>
        You have the right to download a copy of the data Nabad stores about
        you. Choose &quot;Download my data&quot; on your profile page to get one
        file (in JSON format) with your account details, emergency contact,
        linked profiles, health records for you and each linked profile,
        notifications, favorite providers and your care circle.
      </p>

      <ul>
        <li>
          For your security, you confirm it&apos;s you first (with your
          password, or your email for Google sign-in accounts), and Nabad
          emails you after every download.
        </li>
        <li>
          The file never includes your password, sign-in security details or
          anyone else&apos;s health information. For care circles you belong
          to, it only names the person who invited you.
        </li>
        <li>
          Nabad only records that a download happened and the size of the file,
          never what was in it.
        </li>
      </ul>

      <h2>Prototype notice</h2>

      <p>
        Nabad is currently a student software project and prototype. This
        privacy notice describes how information is handled in the current
        project and is not a substitute for a final legal privacy policy for a
        production healthcare system.
      </p>

      <p>
        <Link href="/dashboard">Back to Dashboard</Link>
      </p>
    </PageLayout>
  );
}
