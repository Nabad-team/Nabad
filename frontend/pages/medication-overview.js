import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ProfileHeader from "../components/ProfileHeader";
import { MedicineBox } from "../components/illustrations";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { useActiveProfile } from "../context/ActiveProfileContext";
import {
  getMedicationOverview,
  filterOverview,
  medicationDetails,
  medicationFlags,
  sameNameDetails,
  SAME_NAME_NOTE,
  overviewTotals,
  totalsSentence,
  formatDateTime,
} from "../lib/medicationOverview";

// SCRUM-150: the medications of the signed-in user and every linked profile on one page, e.g. a nurse
// checking her residents during a shift. Residents are linked profiles (no separate sharing system).
// Read-only: each section links to that person's own medications page for editing.
// Printing shows exactly what is on screen (same filters), for a shift handover.

const sectionId = (profile) => `overview-${profile.id}`;

function MedicationRow({ medication, recentChangeDays }) {
  const flags = medicationFlags(medication, recentChangeDays);
  return (
    <li className="overview-medication">
      <div className="overview-medication__main">
        <span className="overview-medication__name">{medication.name}</span>
        {medication.status !== "active" && <Badge tone="neutral">Discontinued</Badge>}
        {flags.map((flag) => <Badge key={flag.key} tone={flag.tone}>{flag.label}</Badge>)}
      </div>
      {/* Every value has its label, on screen and on paper. */}
      <dl className="overview-medication__details">
        {medicationDetails(medication).map((detail) => (
          <div key={detail.key} className={`overview-medication__detail overview-medication__detail--${detail.key}`}>
            <dt>{detail.label}</dt>
            <dd>{detail.value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

function PersonSection({ profile, medications, showDiscontinued, recentChangeDays, sameNameDetail, onEdit }) {
  const headingId = `${sectionId(profile)}-heading`;
  const who = profile.isSelf ? "your" : `${profile.name}'s`;
  const hiddenDiscontinued = !showDiscontinued && profile.counts.discontinued > 0;
  return (
    <section className="overview-person" aria-labelledby={headingId} id={sectionId(profile)}>
      <div className="overview-person__heading">
        {/* The distinguishing detail is part of the heading, so two people with the same name also sound different to screen readers. */}
        <h2 id={headingId}>
          {profile.name}
          {profile.isSelf && !sameNameDetail && <span className="text-muted"> (you)</span>}
          {sameNameDetail && <span className="overview-person__detail"> ({sameNameDetail})</span>}
        </h2>
        <p className="text-muted text-sm overview-person__counts">
          {profile.counts.active} active{profile.counts.discontinued ? `, ${profile.counts.discontinued} discontinued` : ""}
        </p>
      </div>
      {sameNameDetail && <p className="overview-person__same-name"><Badge tone="warning">{SAME_NAME_NOTE}</Badge></p>}
      {profile.flags.noMedications && <p><Badge tone="warning">No medications recorded</Badge></p>}
      {!profile.flags.noMedications && medications.length === 0 && (
        <p className="text-muted">{hiddenDiscontinued ? "No active medications. Turn on “Show discontinued medications” to see the others." : "No medications match your search."}</p>
      )}
      {medications.length > 0 && (
        <ul className="overview-medications" aria-label={profile.isSelf ? "Your medications" : `Medications for ${profile.name}`}>
          {medications.map((medication) => <MedicationRow key={medication.id} medication={medication} recentChangeDays={recentChangeDays} />)}
        </ul>
      )}
      <p className="overview-person__edit">
        <Link href="/medications" onClick={() => onEdit(profile.id)}>
          {profile.isSelf ? "Edit your medications" : `Edit ${who} medications`}
        </Link>
      </p>
    </section>
  );
}

export default function MedicationOverviewPage() {
  const { switchProfile } = useActiveProfile() || {};
  const [overview, setOverview] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [showDiscontinued, setShowDiscontinued] = useState(false);
  const mounted = useRef(true);

  async function load() {
    setLoadError("");
    setOverview(null);
    try {
      const data = await getMedicationOverview();
      if (mounted.current) setOverview(data);
    } catch {
      if (mounted.current) setLoadError("We couldn't load the medication overview. Please check your connection and try again.");
    }
  }

  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
  }, []);

  const profiles = overview?.profiles || [];
  const hasLinked = profiles.some((profile) => !profile.isSelf);
  const filters = { query, onlyActive, showDiscontinued };
  const visible = filterOverview(profiles, filters);
  const totals = overviewTotals(visible);
  const recentChangeDays = overview?.recentChangeDays || 7;
  const filtered = Boolean(query.trim()) || onlyActive;
  // Based on everyone, not only who is on screen: a namesake hidden by a filter still exists.
  const sameNames = sameNameDetails(profiles);

  return (
    <PageLayout title="Medication overview" header={<ProfileHeader showPicture={false} />}>
      <div className="medication-overview">
        <PageTitle lead="Every medication for you and the people you look after, in one place. Open a person's own medications page to make changes.">
          Medication overview
        </PageTitle>

        {loadError && (
          <div className="stack">
            <Alert tone="danger" as="p" role="alert">{loadError}</Alert>
            <div><Button variant="secondary" onClick={load}>Try again</Button></div>
          </div>
        )}

        {!loadError && overview === null && <HeartbeatLoader label="Loading the medication overview..." />}

        {overview && (
          <>
            {!hasLinked && (
              <Alert tone="info" title="No linked profiles yet" className="overview-no-linked">
                <p>
                  To see the medications of the people you look after (for example the residents on your shift), add each person as a
                  linked profile on <Link href="/profile#linked-heading">My profile</Link>, under &ldquo;Linked profiles&rdquo;. Then add their medications on the
                  Medications page while acting as them. They will all appear here.
                </p>
              </Alert>
            )}

            <div className="overview-controls" role="search" aria-label="Filter the medication overview">
              <Input
                id="overview-search"
                type="search"
                label="Search by person or medication"
                placeholder="For example Amal or metformin"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoComplete="off"
              />
              <div className="overview-controls__options">
                <label className="check">
                  <input type="checkbox" checked={onlyActive} onChange={(event) => setOnlyActive(event.target.checked)} />
                  Only people with active medications
                </label>
                <label className="check">
                  <input type="checkbox" checked={showDiscontinued} onChange={(event) => setShowDiscontinued(event.target.checked)} />
                  Show discontinued medications
                </label>
              </div>
              <div className="button-row">
                <Button variant="secondary" onClick={() => window.print()}>Print for handover</Button>
                <Button variant="secondary" href="/medications">Back to medications</Button>
              </div>
            </div>

            <p className="overview-print-header">
              Medication overview, printed {formatDateTime(new Date())}.
              {query.trim() && ` Search: “${query.trim()}”.`}
              {onlyActive && " Only people with active medications."}
              {showDiscontinued ? " Discontinued medications included." : " Active medications only."}
            </p>

            <p className="overview-totals" role="status" aria-live="polite">{totalsSentence(totals, showDiscontinued)}</p>

            {visible.length === 0 ? (
              <EmptyState illustration={<MedicineBox size="5rem" />} title={filtered ? "Nobody matches these filters." : "No medications yet."}>
                {filtered ? "Try a different name, or clear the search and filters." : "Add medications on the Medications page and they will appear here."}
              </EmptyState>
            ) : (
              <div className="overview-people">
                {visible.map(({ profile, medications }) => (
                  <PersonSection
                    key={profile.id}
                    profile={profile}
                    medications={medications}
                    showDiscontinued={showDiscontinued}
                    recentChangeDays={recentChangeDays}
                    sameNameDetail={sameNames.get(profile.id)}
                    onEdit={(id) => switchProfile?.(id)}
                  />
                ))}
              </div>
            )}

            {/* Only on paper (see components.css). */}
            <p className="overview-print-footer">Confidential health information. Do not leave unattended.</p>
          </>
        )}
      </div>
    </PageLayout>
  );
}

// Health data: only for signed-in users (see components/RequireSignIn.js).
MedicationOverviewPage.requireSignIn = true;
