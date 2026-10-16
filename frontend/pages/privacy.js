import Link from "next/link";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";

export default function PrivacyPolicy() {
  return (
    <PageLayout
      title="Privacy Policy"
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
        <strong>Last updated:</strong> October 16, 2026
      </p>

      <h2>Information Nabad stores</h2>

      <p>
        Nabad may store information that you choose to provide, including:
      </p>

      <ul>
        <li>Account and profile information</li>
        <li>Emergency contact information</li>
        <li>Linked profile information</li>
        <li>Symptoms entered into the application</li>
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
        stored in your Nabad account for the selected profile.
      </p>

      <h2>Who can access your information</h2>

      <p>
        Health information is available through an authenticated Nabad account.
        Linked profiles can only be accessed by the account that owns them.
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
          <strong>Brevo</strong> to send account-related emails.
        </li>
        <li>
          <strong>Google</strong> for Google sign-in when that option is used.
        </li>
        <li>
          <strong>OpenStreetMap</strong> map data for healthcare provider maps.
        </li>
      </ul>

      <h2>Logs and health information</h2>

      <p>
        Nabad is designed so that symptom descriptions and other health data are
        not written to application logs.
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
        linked profiles.
      </p>

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