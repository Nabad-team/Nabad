import ProfileHeader from "../components/ProfileHeader";
import EmailVerificationBanner from "../components/EmailVerificationBanner";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { useActiveProfile } from "../context/ActiveProfileContext";

function MicrophoneIcon() {
  return (
    <svg
      width="2.5rem"
      height="2.5rem"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" />
    </svg>
  );
}

export default function DashboardPage() {
  // The active profile (you or a dependent) is loaded by ActiveProfileProvider in _app.js.
  const { activeProfile, error, loading } = useActiveProfile();

  return (
    <PageLayout header={<ProfileHeader />}>
      <EmailVerificationBanner />
      {activeProfile && <PageTitle lead="How are you feeling today?">Welcome, {activeProfile.fullName}</PageTitle>}
      {error && <Alert tone="danger" as="p" role="alert">{error}</Alert>}
      {loading && <HeartbeatLoader />}
      <a href="/symptoms" aria-label="Speak your symptoms" className="action-link">
        <MicrophoneIcon />
        <span>
          <strong className="action-link__title">Speak your symptoms</strong>
          <span>Tap here to describe how you feel by voice.</span>
        </span>
      </a>
      <section className="section" aria-labelledby="account-heading">
        <h2 id="account-heading">Your account</h2>
        <div className="button-row">
          <Button variant="secondary" href="/profile">My Profile</Button>
          <Button variant="secondary" href="/security">Security</Button>
        </div>
      </section>
    </PageLayout>
  );
}

// Health data: only for signed-in users (see components/RequireSignIn.js).
DashboardPage.requireSignIn = true;
