import ProfileHeader from "../components/ProfileHeader";
import { MainNavigation } from "../components/AppHeader";
import EmailVerificationBanner from "../components/EmailVerificationBanner";
import WellbeingCard from "../components/WellbeingCard";
import WellbeingCorner from "../components/WellbeingCorner";
import HealthCard from "../components/HealthCard";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { useAccessibility } from "../context/AccessibilityContext";

// "Rana Haddad" -> "Rana"
// The greeting uses only the first name.
function firstName(fullName) {
  return String(fullName || "")
    .trim()
    .split(/\s+/)[0];
}

const iconProps = {
  width: "1.25rem",
  height: "1.25rem",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.8",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  focusable: "false",
};

function KeyboardIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </svg>
  );
}

function MicrophoneIcon() {
  return (
    <svg {...iconProps}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" />
    </svg>
  );
}

export default function DashboardPage() {
  // The active profile can be the user or a linked dependent.
  const { activeProfile, error, loading } = useActiveProfile();

  const { preferences } = useAccessibility();

  const simplified = preferences.simplifiedMode;

  return (
    <PageLayout
      title="Dashboard"
      header={<ProfileHeader showPicture={false} />}
    >
      <EmailVerificationBanner />

      {activeProfile && (
        <PageTitle>
          Welcome, {firstName(activeProfile.fullName)}
        </PageTitle>
      )}

      <section className="dashboard-navigation" aria-label="Dashboard sections">
        <MainNavigation />
      </section>

      {error && (
        <Alert tone="danger" as="p" role="alert">
          {error}
        </Alert>
      )}

      {loading && <HeartbeatLoader />}

      <section
        className="check-in"
        aria-labelledby="check-in-heading"
      >
        <h2 id="check-in-heading">
          {simplified
            ? "How do you feel?"
            : "Check how you're feeling"}
        </h2>

        <p className={simplified ? "simplified-only-text" : ""}>
          {simplified
            ? "Choose how to tell us."
            : "Describe your symptoms in your own words. Type them, or speak if that's easier."}
        </p>

        <div className="button-row">
          <Button
            href="/symptoms"
            aria-label="Type your symptoms"
          >
            <KeyboardIcon />
            Type
          </Button>

          <Button
            variant="secondary"
            href="/symptoms?voice=1"
            aria-label="Speak your symptoms"
          >
            <MicrophoneIcon />
            Speak
          </Button>
        </div>
      </section>

      {activeProfile && <HealthCard />}

      {activeProfile && <WellbeingCard />}

      <WellbeingCorner />

      <section
        className="section"
        aria-labelledby="account-heading"
      >
        <h2 id="account-heading">
          {simplified ? "More" : "Your account"}
        </h2>

        <div className="button-row">
          <Button
            variant="secondary"
            href="/symptoms"
            aria-label={
              simplified
                ? "Open safety check"
                : undefined
            }
          >
            {simplified
              ? "Safety"
              : "Safety check"}
          </Button>

          <Button
            variant="secondary"
            href="/medications"
            aria-label={
              simplified
                ? "Open medications"
                : undefined
            }
          >
            {simplified
              ? "Medicines"
              : "Medications"}
          </Button>

          <Button
            variant="secondary"
            href="/profile"
            aria-label={
              simplified
                ? "Open my profile"
                : undefined
            }
          >
            {simplified
              ? "Profile"
              : "My profile"}
          </Button>

          <Button
            variant="secondary"
            href="/privacy"
            aria-label={
              simplified
                ? "Open privacy policy"
                : undefined
            }
          >
            {simplified
              ? "Privacy"
              : "Privacy Policy"}
          </Button>
        </div>
      </section>
    </PageLayout>
  );
}

// Only signed-in users can access the dashboard.
DashboardPage.requireSignIn = true;