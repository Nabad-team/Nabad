import ProfileHeader from "../components/ProfileHeader";
import EmailVerificationBanner from "../components/EmailVerificationBanner";
import WellbeingCorner from "../components/WellbeingCorner";
import ProgressSummary from "../components/ProgressSummary";
import { useFirstSteps, GettingStartedSlot, NextStepSlot } from "../components/GettingStartedCard";
import useDashboardData from "../components/useDashboardData";
import PageLayout from "../components/ui/PageLayout";
import Button from "../components/ui/Button";
import HeldMark from "../components/ui/HeldMark";
import Alert from "../components/ui/Alert";
import { SkeletonRegion, Bone, NextStepSkeleton, ProgressSkeleton } from "../components/ui/Skeleton";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { useAccessibility } from "../context/AccessibilityContext";
import { APP_TIME_ZONE, formatDate } from "../lib/dates";
import { hoursText, litresText } from "../lib/wellbeing";

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

function MicrophoneIcon() {
  return (
    <svg {...iconProps}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" />
    </svg>
  );
}

// "Good morning" before noon, "Good afternoon" until 6 pm, then "Good evening", in Beirut time like every time in Nabad.
export function greetingFor(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: APP_TIME_ZONE }).format(date));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

// "Tuesday 24 November", in Beirut time.
export function todayLine(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: APP_TIME_ZONE }).format(date).replace(",", "");
}

// The main thing to do: describe a symptom. Deep spruce, a resting Held mark, one wide button, and speaking as an option.
function SymptomCard({ simplified }) {
  return (
    <section className="symptom-card" aria-labelledby="symptom-card-heading">
      <div className="symptom-card__text">
        <h2 id="symptom-card-heading">Something feels off?</h2>
        <p>{simplified ? "Choose how to tell us." : "Answer a few questions. We'll tell you where to go."}</p>
      </div>
      <HeldMark state="resting" size="4.5rem" className="symptom-card__mark" />
      <div className="symptom-card__actions">
        <Button href="/symptoms" block className="symptom-card__button">Check a symptom</Button>
        <a href="/symptoms?voice=1" className="symptom-card__speak" aria-label="Speak your symptoms">
          <MicrophoneIcon /> Or speak instead
        </a>
      </div>
    </section>
  );
}

// Today's water and sleep (and medicines) as small pills, plus a round button to the breathing exercise.
function YourDay({ data }) {
  const water = data?.wellbeing?.water;
  const sleep = data?.wellbeing?.sleep;
  const medications = data?.medications;
  const taken = medications?.filter((medication) => medication.taken).length || 0;
  return (
    <section className="your-day" aria-labelledby="your-day-heading">
      <h2 id="your-day-heading" className="your-day__heading">Your day</h2>
      <ul className="your-day__pills">
        <li><a href="/water-and-sleep" className="day-pill">
          <span className="day-pill__label">Water</span>{" "}
          {water ? <span className="num">{litresText(water.totalMl)}</span> : <span>not logged</span>}
        </a></li>
        <li><a href="/water-and-sleep" className="day-pill">
          <span className="day-pill__label">Sleep</span>{" "}
          {sleep ? <span className="num">{hoursText(sleep.hours)}</span> : <span>not logged</span>}
        </a></li>
        {medications?.length > 0 && <li><a href="/medications" className="day-pill">
          <span className="day-pill__label">Medicines</span>{" "}
          <span className="num">{taken} of {medications.length}</span>
        </a></li>}
      </ul>
      <a href="/wellbeing" className="breathe-button" aria-label="Breathe for two minutes">
        <HeldMark state="breathe" size="2rem" />
      </a>
    </section>
  );
}

// Desktop only (CSS): the last few symptom checks, each with its level in that level's colours.
function RecentChecks({ symptoms }) {
  const recent = (symptoms || []).filter((record) => record.urgencyResult?.level).slice(0, 3);
  return (
    <section className="recent-checks" aria-labelledby="recent-checks-heading">
      <div className="recent-checks__header">
        <h2 id="recent-checks-heading">Recent checks</h2>
        <a href="/my-history">See all</a>
      </div>
      {symptoms === null ? <p className="text-muted">Loading your recent checks...</p>
        : recent.length === 0 ? <p className="text-muted">No symptom checks yet.</p> : (
          <ul className="recent-checks__list">
            {recent.map((record) => (
              <li key={record.id}>
                <span className="recent-checks__summary">{record.description}</span>
                <span className={`level-chip level-chip--${record.urgencyResult.level}`}>{record.urgencyResult.label}</span>
                {record.createdAt && <span className="recent-checks__date num">{formatDate(record.createdAt)}</span>}
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

// Desktop only (CSS): a way into Wellbeing, in the wellbeing colour.
function WellbeingLink() {
  return (
    <section className="wellbeing-link" aria-labelledby="wellbeing-link-heading">
      <HeldMark state="breathe" size="3rem" />
      <div>
        <h2 id="wellbeing-link-heading">A calm moment</h2>
        <p>Breathing, grounding and a bedtime wind-down.</p>
        <a href="/wellbeing">Open Wellbeing</a>
      </div>
    </section>
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
  // Loaded once for Next step, Your day, Recent checks and Your progress.
  const data = useDashboardData(activeProfile?.id);
  const firstSteps = useFirstSteps({ data: activeProfile ? data : null, forName, isSelf: activeProfile?.isSelf !== false });

  const { preferences } = useAccessibility();

  const simplified = preferences.simplifiedMode;

  // Today, in the Held layout (docs/design-system.md#layouts). Phones: greeting, symptom card, Next step, Your day.
  // Desktop (64rem): the greeting row, then the symptom card and Recent checks on the left, Next step, Your day and
  // a wellbeing card on the right. Everything else follows below, in the order it had before.
  return (
    <PageLayout
      title="Dashboard"
      variant="dashboard"
      header={<ProfileHeader />}
    >
      <EmailVerificationBanner />

      {activeProfile && (
        <div className="today-greeting">
          <p className="today-greeting__date">{todayLine()}</p>
          <h1>{greetingFor()}, {firstName(activeProfile.fullName)}</h1>
        </div>
      )}

      {error && (
        <Alert tone="danger" as="p" role="alert">
          {error}
        </Alert>
      )}

      {/* While the profile loads: the title and Next step as placeholders (one "Loading..." for screen readers). */}
      {loading && (
        <SkeletonRegion label="Loading...">
          <div className="skeleton__stack skeleton__page-title"><Bone size="heading" width="16rem" /><Bone width="22rem" /></div>
          <NextStepSkeleton />
        </SkeletonRegion>
      )}

      <div className="today">
        <div className="today__main">
          <SymptomCard simplified={simplified} />
          {activeProfile && <RecentChecks symptoms={data.symptoms} />}
        </div>
        <div className="today__side">
          {/* Next step, unless the Getting started card applies (that one sits lower down): never both. */}
          {activeProfile && <NextStepSlot firstSteps={firstSteps} data={data} forName={forName} />}
          {activeProfile && <YourDay data={data} />}
          <WellbeingLink />
        </div>
      </div>

      {activeProfile && <GettingStartedSlot firstSteps={firstSteps} forName={forName} />}

      {activeProfile ? <ProgressSummary data={data} /> : loading && <div className="skeleton" aria-hidden="true"><ProgressSkeleton /></div>}

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
