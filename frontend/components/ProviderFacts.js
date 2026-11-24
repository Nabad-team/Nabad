import Badge from "./ui/Badge";
import { formatDate, formatDateTime } from "../lib/dates";
import { providerText as t } from "../lib/providerText";

const REVIEW_INTERVAL_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

function verificationDates(value) {
  const now = Date.now();
  const verified = typeof value === "string" ? new Date(value) : null;
  if (!verified || !Number.isFinite(verified.getTime()) || verified.getTime() > now) return null;
  // The review rule works on whole UTC days (unchanged). UTC midnight is 02:00 or 03:00 in Beirut, so the shown day is the same.
  verified.setUTCHours(0, 0, 0, 0);
  const reviewDue = new Date(verified.getTime() + REVIEW_INTERVAL_DAYS * DAY_MS);
  return {
    checked: formatDate(verified),
    due: formatDate(reviewDue),
    outdated: now >= reviewDue.getTime(),
  };
}

// The status chips a result card shows side by side. Only known facts: distance (card: in the meta line instead),
// driving time, open or closed per published hours, and the 24/7 ER status when it is published (yes or no). Unknown
// hours and an unverified ER status get no chip (the "About this data" note explains this).
export function ProviderBadges({ provider: p, showLiveStatus = true, drivingMinutes, card = false }) {
  const opening = showLiveStatus && (p.openingStatus === "open" || p.openingStatus === "closed") ? p.openingStatus : null;
  const er = p.emergency24h === true ? "erYes" : p.emergency24h === false ? "erNo" : null;
  const badges = [
    !card && p.distanceKm != null && <Badge tone="neutral">{t("distance", { km: p.distanceKm })}</Badge>,
    Number.isFinite(drivingMinutes) && <Badge tone="neutral">{t("drivingMinutes", { minutes: drivingMinutes })}</Badge>,
    opening && <Badge tone={opening === "open" ? "info" : "neutral"}>{t(opening)}</Badge>,
    er && <Badge tone={er === "erYes" ? "info" : "neutral"}>{t(er)}</Badge>,
  ].filter(Boolean);
  if (!badges.length) return null;
  return <ul className="provider-badges" aria-label={t("keyFacts", { name: p.name })}>
    {badges.map((badge, index) => <li key={index}>{badge}</li>)}
  </ul>;
}

// What a result card must never hide (everything else is on the facility's own page): information that may be
// outdated, an approximate map pin, and an address or map location that isn't verified (so no Directions).
export function ProviderCaveats({ provider: p }) {
  const verification = verificationDates(p.verifiedAt);
  const notes = [
    (!verification || verification.outdated) && <><Badge tone="warning">{t("possiblyOutdated")}</Badge> {t("confirmBeforeVisiting")}</>,
    p.locationApproximate && t("approximatePin"),
    !p.address && t("addressUnknown"),
    !hasMapLocation(p) && t("locationUnknown"),
  ].filter(Boolean);
  if (!notes.length) return null;
  return <div className="provider-card__caveats">{notes.map((note, index) => <p key={index} className="text-sm">{note}</p>)}</div>;
}

// variant="full": every fact (the provider page and the comparison). variant="details": the "More details" part of a
// result card, which leaves out only what the card already shows above it (type and city, the badges, Call, Directions).
export default function ProviderFacts({ provider: p, showLiveStatus = true, drivingMinutes, variant = "full" }) {
  const full = variant === "full";
  const feedback = p.feedback;
  const waiting = feedback?.waiting;
  const verification = verificationDates(p.verifiedAt);
  return <>
    {full ? <p>{t(p.type)}{p.city ? ` \u00b7 ${p.city}` : ""}{p.district ? ` \u00b7 ${t("district")}: ${p.district}` : ""}</p>
      : p.district && <p>{t("district")}: {p.district}</p>}
    <p>{p.address || t("addressUnknown")}</p>
    {(!verification || verification.outdated) && <p><Badge tone={full ? "neutral" : "warning"}>{t("possiblyOutdated")}</Badge> {t("confirmBeforeVisiting")}</p>}
    {full && p.distanceKm != null && <p><Badge tone="neutral">{t("distance", { km: p.distanceKm })}</Badge></p>}
    {full && Number.isFinite(drivingMinutes) && <p><Badge tone="neutral">{t("drivingMinutes", { minutes: drivingMinutes })}</Badge></p>}
    {p.locationApproximate && <p>{t("approximatePin")}</p>}
    <p>{p.specialties?.length ? p.specialties.map(s => t(`specialties.${s}`)).join(", ") : t("specialtiesUnknown")}</p>
    {full && showLiveStatus && <p><Badge tone={p.openingStatus === "open" ? "info" : "neutral"}>{t(p.openingStatus || "unknown")}</Badge></p>}
    {full && <p><Badge tone={p.emergency24h === true ? "info" : "neutral"}>{t(p.emergency24h === true ? "erYes" : p.emergency24h === false ? "erNo" : "erUnknown")}</Badge></p>}
    <p>{p.services?.length ? `${t("service")}: ${p.services.map(s => t(`services.${s}`)).join(", ")}` : t("servicesUnknown")}</p>
    <p className="text-muted">{t("servicesNote")}</p>
    {p.servicesReviewedAt && <p className="text-muted">{t("servicesChecked", { date: formatDate(p.servicesReviewedAt) })}</p>}
    {p.serviceSources?.map((url, i) => <p key={url}><a href={url} target="_blank" rel="noopener noreferrer">{t("serviceSource", { number: i + 1 })}</a></p>)}
    <p>{p.insurances?.length ? `${t("insurance")}: ${p.insurances.map(s => t(`insurances.${s}`)).join(", ")}` : t("insuranceUnknown")}</p>
    {p.insuranceVerifiedAt && <p className="text-muted">{t("insuranceChecked", { date: formatDate(p.insuranceVerifiedAt) })}</p>}
    <p className="text-muted">{t("insuranceNote")}</p>
    {p.insuranceSources?.map((url, i) => <p key={url}><a href={url} target="_blank" rel="noopener noreferrer">{t("insuranceSource", { number: i + 1 })}</a></p>)}
    <p>{feedback?.count ? t("ratingSummary", { rating: feedback.averageRating, count: feedback.count }) : t("noFeedback")}</p>
    {showLiveStatus && <>
      <p><Badge tone="neutral">{t(`waiting.${waiting?.level || "unknown"}`)}</Badge></p>
      {waiting?.updatedAt && <p className="text-muted">{t("waitingUpdated", { date: formatDateTime(waiting.updatedAt), count: waiting.reportCount })}</p>}
      <p className="text-muted">{t("waitingNote")}</p>
    </>}
    {p.hoursKnown && <details><summary>{t("hoursTitle")}</summary>
      <ul>{p.hours.map((slot, i) => <li key={i}>{t(`day${slot.day}`)}: {time(slot.start)}\u2013{time(slot.end)} {slot.end < slot.start ? t("overnight") : ""}</li>)}</ul>
    </details>}
    <p className="text-muted">{t("hoursNote")}</p>
    {full && p.phone && <p><a href={`tel:${p.phone}`}>{t("call", { name: p.name })}</a></p>}
    {hasMapLocation(p) ? full && <p><a className="button button--secondary" href={directionsUrl(p)} target="_blank" rel="noopener noreferrer">{t("directions")}</a></p> : <p>{t("locationUnknown")}</p>}
    {verification ? <>
      <p className="text-muted">{t("checked", { date: verification.checked })}</p>
      <p className="text-muted">{t("reviewDue", { date: verification.due })}</p>
    </> : <p className="text-muted">{t("verificationUnknown")}</p>}
    <div className="provider-sources">{p.sources?.map((url, i) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">{t("source", { number: i + 1 })}</a>)}</div>
  </>;
}
export const hasMapLocation = (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude);
export const directionsUrl = (p) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${p.latitude},${p.longitude}`)}`;
function time(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; }
