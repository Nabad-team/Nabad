import ProfileHeader from "../components/ProfileHeader";
import EmailVerificationBanner from "../components/EmailVerificationBanner";
import WellbeingCorner from "../components/WellbeingCorner";
import ProgressSummary from "../components/ProgressSummary";
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

// Quick actions: one small line icon each (same style as the menu icons), so every button reads the same way.
const QUICK_ICONS = {
  vitals: <path d="M3 12h4l2-5 4 10 2-5h6" />,
  medication: <><path d="m8.5 4.5 11 11a3.5 3.5 0 0 1-5 5l-11-11a3.5 3.5 0 0 1 5-5Z" /><path d="m6 7 5 5" /></>,
  appointment: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18M12 12v6M9 15h6" /></>,
  document: <><path d="M6 3h8l5 5v13H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5M12 11v6M9 14l3-3 3 3" /></>,
};

function QuickAction({ href, icon, label, fullLabel }) {
  return (
    <li>
      <a href={href} className="quick-action" aria-label={fullLabel}>
        <svg {...iconProps} className="quick-action__icon">{QUICK_ICONS[icon]}</svg>
        <span>{label}</span>
      </a>
    </li>
  );
}

export default function DashboardPage() {
  // The active profile can be the user or a linked dependent.
  const { activeProfile, error, loading } = useActiveProfile();
  const forName = activeProfile?.isSelf === false ? firstName(activeProfile.fullName) : "";
  const actionFor = forName ? ` for ${forName}` : "";

  const { preferences } = useAccessibility();

  const simplified = preferences.simplifiedMode;

  return (
    <PageLayout
      title="Dashboard"
      variant="dashboard"
      header={<ProfileHeader showPicture={false} />}
    >
      <EmailVerificationBanner />

      {activeProfile && (
        <PageTitle lead="Your health, your records, and your next steps, together.">
          Welcome, {firstName(activeProfile.fullName)}
        </PageTitle>
      )}

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
          Symptom check
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

      {activeProfile && <ProgressSummary />}

      <section className="quick-actions section" aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading">Quick actions</h2>
        <p className="text-muted">{forName ? `Go straight to something you want to update for ${forName}.` : "Go straight to something you want to update."}</p>
        <nav aria-label="Quick actions">
          <ul className="quick-actions__list">
            <QuickAction href="/vitals" icon="vitals" label="Log vitals" fullLabel={`Log vitals${actionFor}`} />
            <QuickAction href="/medications" icon="medication" label="Add medication" fullLabel={`Add medication${actionFor}`} />
            <QuickAction href="/appointments" icon="appointment" label="Add appointment" fullLabel={`Add appointment${actionFor}`} />
            <QuickAction href="/medical-documents" icon="document" label="Upload document" fullLabel={`Upload document${actionFor}`} />
          </ul>
        </nav>
      </section>

      <WellbeingCorner />
    </PageLayout>
  );
}

// Only signed-in users can access the dashboard.
DashboardPage.requireSignIn = true;
