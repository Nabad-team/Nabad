import ProfileHeader from "../components/ProfileHeader";
import EmailVerificationBanner from "../components/EmailVerificationBanner";
import WellbeingCorner from "../components/WellbeingCorner";
import YourHealth from "../components/YourHealth";
import { useFirstSteps, NextStepSlot } from "../components/GettingStartedCard";
import useDashboardData from "../components/useDashboardData";
import PageLayout from "../components/ui/PageLayout";
import Button from "../components/ui/Button";
import HeldMark from "../components/ui/HeldMark";
import Timeline from "../components/ui/Timeline";
import Alert from "../components/ui/Alert";
import { SkeletonRegion, Bone, NextStepSkeleton, HealthTilesSkeleton } from "../components/ui/Skeleton";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { useAccessibility } from "../context/AccessibilityContext";
import { APP_TIME_ZONE, formatDate } from "../lib/dates";
import { hoursText } from "../lib/wellbeing";

// "Rana Haddad" -> "Rana"
// The greeting uses only the first name.
function firstName(fullName) {
  return String(fullName || "")
    .trim()
    .split(/\s+/)[0];
}

function MicrophoneIcon() {
  return (
    <svg width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
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

// The main thing to do: describe a symptom. Deep spruce, a resting Held mark (the dashboard's one Held mark besides
// the logo), one wide button, and speaking as an option.
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

// "0.8", "2" (no "2.0"): litres for the meters, at most two decimals.
const litres = (ml) => String(Math.round(ml / 10) / 100);

// One meter: a label, the value (numbers through the digits font), and a bar when there is something to measure
// against. The whole meter is the link. The bar is decorative: the value says the same in words.
function Meter({ href, label, value, fraction }) {
  return (
    <a href={href} className="day-meter">
      <span className="day-meter__label">{label}</span>{" "}
      <span className="day-meter__value">{value}</span>
      {fraction !== null && (
        <span className="day-meter__bar" aria-hidden="true"><span style={{ width: `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` }} /></span>
      )}
    </a>
  );
}

// Today's water and last night's sleep, as two meters in one white card, linking to Water and sleep.
//   Water: "0.8 of 2 L" filling toward the daily goal (or limit); "0.8 L today" without a goal; "Not logged".
//   Sleep: the hours on a 0 to 12 hour bar; "Not logged". No healthy-range band: the app defines no sleep target.
export const SLEEP_SCALE_HOURS = 12;
export function waterMeter(water) {
  if (!water || !water.totalMl) return { value: "Not logged", fraction: null };
  const goal = water.goal?.ml;
  if (!goal) return { value: `${litres(water.totalMl)} L today`, fraction: null };
  return { value: `${litres(water.totalMl)} of ${litres(goal)} L${water.goal.type === "atMost" ? " limit" : ""}`, fraction: water.totalMl / goal };
}
export function sleepMeter(sleep) {
  if (!sleep) return { value: "Not logged", fraction: null };
  return { value: hoursText(sleep.hours), fraction: sleep.hours / SLEEP_SCALE_HOURS };
}

function YourDay({ data }) {
  const water = waterMeter(data?.wellbeing?.water);
  const sleep = sleepMeter(data?.wellbeing?.sleep);
  return (
    <section className="your-day" aria-labelledby="your-day-heading">
      <h2 id="your-day-heading" className="your-day__heading">Your day</h2>
      <div className="your-day__card">
        <Meter href="/water-and-sleep" label="Water" {...water} />
        <Meter href="/water-and-sleep" label="Sleep" {...sleep} />
      </div>
    </section>
  );
}

// Desktop only (CSS): the last few symptom checks, in the shared timeline style (components/ui/Timeline.js).
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
          <Timeline label="Recent checks" className="recent-checks__list" items={recent.map((record) => ({
            key: record.id, id: undefined, kind: "Symptom check",
            date: record.createdAt ? formatDate(record.createdAt) : "",
            words: record.description,
            chip: { text: record.urgencyResult.label, level: record.urgencyResult.level },
            href: `/symptoms#check-${record.id}`,
          }))} />
        )}
    </section>
  );
}

export default function DashboardPage() {
  // The active profile can be the user or a linked dependent.
  const { activeProfile, error, loading } = useActiveProfile();
  const forName = activeProfile?.isSelf === false ? firstName(activeProfile.fullName) : "";
  // Loaded once for Next step, Your day, Recent checks and Your health.
  const data = useDashboardData(activeProfile?.id);
  const firstSteps = useFirstSteps({ data: activeProfile ? data : null, forName, isSelf: activeProfile?.isSelf !== false });

  const { preferences } = useAccessibility();

  const simplified = preferences.simplifiedMode;

  // Today, in the Held layout (docs/design-system.md#layouts). Phones: greeting, symptom card, Next step, Your day.
  // Desktop (64rem): the greeting row, then the symptom card and Recent checks on the left, Next step and Your day on
  // the right. Below: Your health (one grid of tiles, with the first steps as To do tags) and the Wellbeing Corner.
  // Say each thing once: the emergency call is the sidebar button (desktop) and the Red Cross row, besides the footer.
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
          {/* Next step, unless the first steps apply (their To do tags are on Your health below): never both. */}
          {activeProfile && <NextStepSlot firstSteps={firstSteps} data={data} forName={forName} />}
          {activeProfile && <YourDay data={data} />}
        </div>
      </div>

      {activeProfile ? <YourHealth data={data} firstSteps={firstSteps} forName={forName} />
        : loading && <div className="skeleton" aria-hidden="true"><HealthTilesSkeleton /></div>}

      <WellbeingCorner />
    </PageLayout>
  );
}

// Only signed-in users can access the dashboard.
DashboardPage.requireSignIn = true;
