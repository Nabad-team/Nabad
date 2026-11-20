// SCRUM-332: "My health story". A month-by-month timeline of one profile's own records on /my-history: symptom
// checks, appointments, medication changes (started and stopped), medical documents and vitals, each with a link to
// where it lives in Nabad. It extends SCRUM-156 (questions about your history), which reads the same records.
//
// buildHealthStory({ owner, profileId, months, until, timeZone, now })
//   -> { from, until, timeZone, months: [{ month, label, counts, events }], counts, hasEarlier, earlierUntil, truncated }
//
// - `until` is the last month shown ("YYYY-MM", the current month by default) and `months` how many months back from
//   it (1 to 12, default 6). "Show earlier months" asks again with until = earlierUntil.
// - Months are newest first and only months with something in them are listed; events in a month are newest first.
// - Days are the person's own calendar days in their time zone. Appointments keep the date they were saved with.
// - Vitals are grouped into one event per day, so a week of daily blood pressure readings doesn't drown everything else.
// - Medication "changes" are what Nabad records: the start date and, when it was stopped, the end date. Edits to a dose
//   are not kept as history, so they can't be shown.
// - Every query is filtered by owner and profileId: only the signed-in account's chosen profile is ever read.
// - Nothing here is logged or sent to an AI model.

const SymptomRecord = require("./models/SymptomRecord");
const Appointment = require("./models/Appointment");
const Medication = require("./models/Medication");
const MedicalDocument = require("./models/MedicalDocument");
const VitalReading = require("./models/VitalReading");
const { localTime, validTimeZone } = require("./appointmentReminders");

const DEFAULT_TIME_ZONE = "Asia/Beirut";
const DEFAULT_MONTHS = 6;
const MAX_MONTHS = 12;
const MAX_PER_KIND = 500; // records read per kind in one window, newest first
const TYPES = ["symptom-check", "appointment", "medication", "document", "vitals"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOCUMENT_TYPES = { imaging: "Imaging", lab: "Lab result", letter: "Letter", other: "Document" };
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

const pad = (number) => String(number).padStart(2, "0");
const monthKey = (year, month) => `${year}-${pad(month)}`; // month is 1 to 12
function shiftMonth(key, delta) {
  const [year, month] = key.split("-").map(Number);
  const index = year * 12 + (month - 1) + delta;
  return monthKey(Math.floor(index / 12), (index % 12) + 1);
}
const monthLabel = (key) => `${MONTH_NAMES[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;

function localParts(instant, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(instant).map(({ type, value }) => [type, value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
// Dates saved as a calendar day (medication start and end, document dates) are stored as UTC midnight.
const utcDay = (value) => new Date(value).toISOString().slice(0, 10);
const clip = (value, max) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

// Reads and checks the query: { value } or { error }.
function readStoryQuery(query = {}, now = new Date()) {
  const timeZone = query.timeZone === undefined || query.timeZone === "" ? DEFAULT_TIME_ZONE : query.timeZone;
  if (!validTimeZone(timeZone)) return { error: "Invalid time zone." };
  let months = DEFAULT_MONTHS;
  if (query.months !== undefined) {
    months = Number(query.months);
    if (!Number.isInteger(months) || months < 1 || months > MAX_MONTHS) return { error: `Choose between 1 and ${MAX_MONTHS} months.` };
  }
  const current = localParts(now, timeZone).day.slice(0, 7);
  let until = current;
  if (query.until !== undefined) {
    if (typeof query.until !== "string" || !MONTH.test(query.until) || query.until < "2000-01") return { error: "Choose a month as YYYY-MM." };
    until = query.until > current ? current : query.until;
  }
  return { value: { timeZone, months, until } };
}

async function buildHealthStory({ owner, profileId, months = DEFAULT_MONTHS, until, timeZone = DEFAULT_TIME_ZONE, now = new Date() }) {
  const last = until || localParts(now, timeZone).day.slice(0, 7);
  const from = shiftMonth(last, -(months - 1));
  const fromDay = `${from}-01`;
  const afterDay = `${shiftMonth(last, 1)}-01`; // first day after the window
  const start = localTime(fromDay, "00:00", timeZone);
  const end = localTime(afterDay, "00:00", timeZone);
  const startUtc = new Date(`${fromDay}T00:00:00Z`);
  const endUtc = new Date(`${afterDay}T00:00:00Z`);
  const today = localParts(now, timeZone).day;
  const scoped = { owner, profileId };
  const query = (model, filter, fields, sort) => model.find({ ...scoped, ...filter }).select(fields).sort(sort).limit(MAX_PER_KIND).maxTimeMS(3000).lean();

  const [checks, visits, medications, documents, vitals] = await Promise.all([
    query(SymptomRecord, { createdAt: { $gte: start, $lt: end } }, "description urgencyResult createdAt", { createdAt: -1 }),
    query(Appointment, { appointmentDate: { $gte: fromDay, $lt: afterDay } }, "title hospital location appointmentDate appointmentTime", { appointmentDate: -1, appointmentTime: -1 }),
    query(Medication, { $or: [{ startDate: { $gte: startUtc, $lt: endUtc } }, { endDate: { $gte: startUtc, $lt: endUtc } }] }, "name dose unit frequency startDate endDate status", { startDate: -1 }),
    query(MedicalDocument, { $or: [{ documentDate: { $gte: startUtc, $lt: endUtc } }, { documentDate: null, createdAt: { $gte: start, $lt: end } }] }, "filename documentType documentDate createdAt", { createdAt: -1 }),
    query(VitalReading, { recordedAt: { $gte: start, $lt: end } }, "recordedAt systolic diastolic heartRate temperature", { recordedAt: -1 }),
  ]);
  const truncated = [checks, visits, medications, documents, vitals].some((list) => list.length === MAX_PER_KIND);

  const events = [];
  const add = (event) => events.push(event);

  for (const check of checks) {
    const { day, time } = localParts(check.createdAt, timeZone);
    const level = check.urgencyResult?.level;
    add({
      type: "symptom-check", id: String(check._id), day, time, sortKey: new Date(check.createdAt).getTime(),
      title: "Symptom check", detail: clip(check.description, 200),
      badge: check.urgencyResult?.label ? clip(check.urgencyResult.label, 60) : "",
      attention: level === "emergency" || level === "urgent",
      href: "/symptoms",
    });
  }
  for (const visit of visits) {
    add({
      type: "appointment", id: String(visit._id), day: visit.appointmentDate, time: visit.appointmentTime,
      sortKey: Date.parse(`${visit.appointmentDate}T${visit.appointmentTime || "00:00"}:00Z`),
      title: clip(visit.title, 120), detail: clip([visit.hospital, visit.location].filter(Boolean).join(", "), 200),
      badge: visit.appointmentDate > today ? "Upcoming" : "",
      href: `/appointments#appointment-${visit._id}`,
    });
  }
  for (const medication of medications) {
    const details = clip([[medication.dose, medication.unit].filter(Boolean).join(" "), medication.frequency].filter(Boolean).join(", "), 160);
    const href = `/medications#medication-${medication._id}`;
    const started = new Date(medication.startDate);
    if (started >= startUtc && started < endUtc) {
      add({ type: "medication", id: `${medication._id}-started`, day: utcDay(started), sortKey: started.getTime(), title: `Started ${clip(medication.name, 100)}`, detail: details, badge: "", href });
    }
    const ended = medication.endDate ? new Date(medication.endDate) : null;
    if (ended && ended >= startUtc && ended < endUtc) {
      // An end date still in the future is "Stops X" (planned), not "Stopped X".
      const future = utcDay(ended) > today;
      add({ type: "medication", id: `${medication._id}-stopped`, day: utcDay(ended), sortKey: ended.getTime() + 1, title: `${future ? "Stops" : "Stopped"} ${clip(medication.name, 100)}`, detail: details, badge: future ? "Planned" : "", href });
    }
  }
  for (const document of documents) {
    const dated = Boolean(document.documentDate);
    const { day, time } = dated ? { day: utcDay(document.documentDate), time: "" } : localParts(document.createdAt, timeZone);
    add({
      type: "document", id: String(document._id), day, time: dated ? "" : time,
      sortKey: new Date(dated ? document.documentDate : document.createdAt).getTime(),
      title: clip(document.filename, 120), detail: `${DOCUMENT_TYPES[document.documentType] || "Document"}${dated ? "" : ", date not given (day uploaded)"}`,
      badge: "", href: `/medical-documents#document-${document._id}`,
    });
  }
  // Vitals: one event per day, described by the day's latest value of each kind.
  const vitalDays = new Map();
  for (const reading of vitals) {
    const { day, time } = localParts(reading.recordedAt, timeZone);
    if (!vitalDays.has(day)) vitalDays.set(day, { readings: [], time, sortKey: new Date(reading.recordedAt).getTime() });
    vitalDays.get(day).readings.push(reading); // newest first
  }
  for (const [day, { readings, time, sortKey }] of vitalDays) {
    const latest = (field) => readings.find((reading) => reading[field] !== undefined && reading[field] !== null);
    const pressure = readings.find((reading) => reading.systolic && reading.diastolic);
    const heart = latest("heartRate");
    const temperature = latest("temperature");
    const parts = [
      pressure && `Blood pressure ${pressure.systolic}/${pressure.diastolic}`,
      heart && `heart rate ${heart.heartRate}`,
      temperature && `temperature ${temperature.temperature} °C`,
    ].filter(Boolean);
    add({
      type: "vitals", id: `vitals-${day}`, day, time, sortKey,
      title: readings.length === 1 ? "Vitals recorded" : `${readings.length} vitals readings`,
      detail: parts.length ? `${readings.length > 1 ? "Latest: " : ""}${parts.join(", ")}` : "", badge: "", href: "/vitals",
    });
  }

  const counts = Object.fromEntries(TYPES.map((type) => [type, 0]));
  const byMonth = new Map();
  for (const event of events) {
    counts[event.type] += 1;
    const key = event.day.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(event);
  }
  const monthList = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, list]) => ({
      month: key, label: monthLabel(key),
      counts: Object.fromEntries(TYPES.map((type) => [type, list.filter((event) => event.type === type).length])),
      events: list.sort((a, b) => b.day.localeCompare(a.day) || b.sortKey - a.sortKey).map(({ sortKey, ...event }) => event),
    }));

  // Is there anything before the window? One quick look per kind, so "Show earlier months" only appears when it helps.
  const before = await Promise.all([
    SymptomRecord.exists({ ...scoped, createdAt: { $lt: start } }),
    Appointment.exists({ ...scoped, appointmentDate: { $lt: fromDay } }),
    Medication.exists({ ...scoped, $or: [{ startDate: { $lt: startUtc } }, { endDate: { $lt: startUtc } }] }),
    MedicalDocument.exists({ ...scoped, $or: [{ documentDate: { $lt: startUtc } }, { documentDate: null, createdAt: { $lt: start } }] }),
    VitalReading.exists({ ...scoped, recordedAt: { $lt: start } }),
  ]);
  const hasEarlier = before.some(Boolean);

  return {
    from, until: last, timeZone, months: monthList, counts, truncated,
    hasEarlier, earlierUntil: hasEarlier ? shiftMonth(from, -1) : null,
  };
}

module.exports = { buildHealthStory, readStoryQuery, shiftMonth, TYPES, DEFAULT_MONTHS, MAX_MONTHS, MAX_PER_KIND };
