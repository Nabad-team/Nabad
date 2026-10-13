import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <main
      style={{
        maxWidth: "850px",
        margin: "0 auto",
        padding: "40px 24px",
        lineHeight: "1.6",
      }}
    >
      <h1>Nabad Privacy Policy</h1>

      <p>
        Nabad is designed to help users manage health-related information while
        keeping privacy and security in mind.
      </p>

      <h2>Information We Collect</h2>

      <p>Nabad may store information that you choose to provide, including:</p>

      <ul>
        <li>Account and profile information</li>
        <li>Emergency contact information</li>
        <li>Linked profile information</li>
        <li>Symptoms entered into the application</li>
        <li>Health information that you choose to save</li>
      </ul>

      <h2>How Your Information Is Used</h2>

      <p>
        Information entered into Nabad is used to provide the application's
        health-management features, such as symptom assessment, emergency
        assistance, and personal health records.
      </p>

      <h2>Who Can Access Your Information</h2>

      <p>
        Your personal information should only be available through your
        authenticated Nabad account and to authorized users who have permission
        to manage a linked profile.
      </p>

      <h2>Emergency Information</h2>

      <p>
        During an emergency alert, Nabad may display information such as your
        saved emergency contact and emergency phone numbers so that you can
        quickly seek help.
      </p>

      <h2>Data Security</h2>

      <p>
        Nabad uses security measures such as account authentication and secure
        handling of application data. Users should also protect their passwords
        and sign out when using shared devices.
      </p>

      <h2>Your Choices</h2>

      <p>
        You can update information stored in your profile. Where supported by
        the application, you may also remove information or delete your account.
      </p>

      <h2>Prototype Notice</h2>

      <p>
        Nabad is currently a student software project and prototype. This
        privacy notice describes the intended handling of information within
        the project and is not a substitute for a final legal privacy policy for
        a production healthcare system.
      </p>

      <div style={{ marginTop: "30px" }}>
        <Link href="/dashboard">Back to Dashboard</Link>
      </div>
    </main>
  );
}