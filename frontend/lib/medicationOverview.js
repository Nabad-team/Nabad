import { request } from "./api";
import { formatDate } from "./dates";

// The medication overview (SCRUM-150): every medication of the signed-in user and of all their linked
// profiles, e.g. a nurse checking her residents during a shift (backend: GET /api/medications/overview).
// Each profile: { id ("self" or a linked profile id), name, isSelf, relationship, counts, flags, medications }.
// Each medication: { id, name, dose, unit, form, frequency, times, status, startDate, endDate, updatedAt,
// flags: { missingDose, missingSchedule, changedRecently } }. The server computes the flags.
export const getMedicationOverview = () => request("/medications/overview");

const normalize = (text) => String(text || "").trim().toLocaleLowerCase("en");

// What is on screen, given the filters. Returns [{ profile, medications }] in the server's order.
//   query:            matches a person's name (then all their shown medications stay) or a medication's name.
//   onlyActive:       only people with at least one active medication.
//   showDiscontinued: include discontinued medications (otherwise active only).
export function filterOverview(profiles, { query = "", onlyActive = false, showDiscontinued = false } = {}) {
  const q = normalize(query);
  const visible = [];
  for (const profile of profiles || []) {
    if (onlyActive && !profile.counts?.active) continue;
    const shown = profile.medications.filter((m) => showDiscontinued || m.status === "active");
    if (!q) { visible.push({ profile, medications: shown }); continue; }
    if (normalize(profile.name).includes(q)) { visible.push({ profile, medications: shown }); continue; }
    const matching = shown.filter((m) => normalize(m.name).includes(q));
    if (matching.length) visible.push({ profile, medications: matching });
  }
  return visible;
}

const FORM_LABELS = { tablet: "Tablet", syrup: "Syrup", injection: "Injection", inhaler: "Inhaler", drops: "Drops", other: "Other" };
export const NOT_RECORDED = "Not recorded";

// Every field with its label, so nothing is ever a bare number on screen or on paper
// (a frequency of "5" reads "Frequency: 5", not "· 5"). Missing dose and frequency say so.
//   [{ key, label, value }]
export function medicationDetails(medication) {
  const details = [
    { key: "dose", label: "Dose", value: medication.dose ? [medication.dose, medication.unit].filter(Boolean).join(" ") : NOT_RECORDED },
    { key: "form", label: "Route / form", value: FORM_LABELS[medication.form] || medication.form || NOT_RECORDED },
    { key: "frequency", label: "Frequency", value: medication.frequency || NOT_RECORDED },
  ];
  if ((medication.times || []).length) details.push({ key: "times", label: "Times", value: medication.times.join(", ") });
  details.push(medication.endDate
    ? { key: "dates", label: "Dates", value: `${formatDate(medication.startDate)} to ${formatDate(medication.endDate)}` }
    : { key: "dates", label: "Started", value: formatDate(medication.startDate) || NOT_RECORDED });
  details.push({ key: "updated", label: "Last updated", value: formatDateTime(medication.updatedAt) || NOT_RECORDED });
  return details;
}

// ---- People with the same name ----------------------------------------------------------------------
const nameKey = (name) => normalize(name).replace(/\s+/g, " ");
const RELATIONSHIP_LABELS = { child: "Child", parent: "Parent", spouse: "Spouse", other: "Other" };

// Existing profile fields only, never invented: who they are to the user, date of birth, and (only if
// those are the same too) when the profile was added.
function baseDetail(profile) {
  return [profile.isSelf ? "You" : RELATIONSHIP_LABELS[profile.relationship] || "", profile.dateOfBirth ? `born ${formatDate(profile.dateOfBirth)}` : ""]
    .filter(Boolean).join(", ");
}

// For every profile that shares its name (ignoring case and extra spaces) with another profile in the
// overview, a short distinguishing detail. Profiles with a unique name are not in the map.
//   Map(id -> "Other, born 3 February 1941")
export function sameNameDetails(profiles) {
  const groups = new Map();
  for (const profile of profiles || []) {
    const key = nameKey(profile.name);
    groups.set(key, [...(groups.get(key) || []), profile]);
  }
  const details = new Map();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const counts = new Map();
    for (const profile of group) counts.set(baseDetail(profile), (counts.get(baseDetail(profile)) || 0) + 1);
    for (const profile of group) {
      const base = baseDetail(profile);
      const tie = counts.get(base) > 1 && profile.addedOn ? `profile added ${formatDate(profile.addedOn)}` : "";
      details.set(profile.id, [base, tie].filter(Boolean).join(", "));
    }
  }
  return details;
}

export const SAME_NAME_NOTE = "Same name as another person, check carefully";

// The flags of one medication, in words (never color alone). tone matches the Badge component.
export function medicationFlags(medication, recentChangeDays = 7) {
  const flags = [];
  if (medication.flags?.missingDose) flags.push({ key: "missingDose", label: "Missing dose", tone: "warning" });
  if (medication.flags?.missingSchedule) flags.push({ key: "missingSchedule", label: "Missing schedule", tone: "warning" });
  if (medication.flags?.changedRecently) flags.push({ key: "changedRecently", label: `Changed in the last ${recentChangeDays} days`, tone: "info" });
  return flags;
}

// Totals for the visible list, for the summary line read by screen readers.
export function overviewTotals(visible) {
  let active = 0, discontinued = 0, needsCheck = 0;
  for (const { medications } of visible) {
    for (const m of medications) {
      if (m.status === "active") active++; else discontinued++;
      if (m.flags?.missingDose || m.flags?.missingSchedule) needsCheck++;
    }
  }
  return { people: visible.length, active, discontinued, needsCheck };
}

const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function totalsSentence({ people, active, discontinued, needsCheck }, showDiscontinued) {
  const parts = [plural(people, "person", "people"), plural(active, "active medication")];
  if (showDiscontinued) parts.push(`${discontinued} discontinued`);
  if (needsCheck) parts.push(`${needsCheck} missing a dose or schedule`);
  return `Showing ${parts.join(", ")}.`;
}

// "8 November 2026, 14:05" in the viewer's time zone, for "Last updated" and the printed handover header.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
