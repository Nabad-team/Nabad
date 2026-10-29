import Badge from "./ui/Badge";
import { providerText as t } from "../lib/providerText";
export default function ProviderFacts({ provider: p }) {
  const feedback = p.feedback;
  const waiting = feedback?.waiting;
  return <>
    <p>{t(p.type)}{p.city ? ` \u00b7 ${p.city}` : ""}{p.district ? ` \u00b7 ${t("district")}: ${p.district}` : ""}</p>
    <p>{p.address || t("addressUnknown")}</p>
    {p.distanceKm != null && <p><Badge tone="neutral">{t("distance", { km: p.distanceKm })}</Badge></p>}
    {p.locationApproximate && <p>{t("approximatePin")}</p>}
    <p>{p.specialties?.length ? p.specialties.map(s => t(`specialties.${s}`)).join(", ") : t("specialtiesUnknown")}</p>
    <p><Badge tone={p.openingStatus === "open" ? "info" : "neutral"}>{t(p.openingStatus || "unknown")}</Badge></p>
    <p><Badge tone={p.emergency24h === true ? "info" : "neutral"}>{t(p.emergency24h === true ? "erYes" : p.emergency24h === false ? "erNo" : "erUnknown")}</Badge></p>
    <p>{p.services?.length ? `${t("service")}: ${p.services.map(s => t(`services.${s}`)).join(", ")}` : t("servicesUnknown")}</p>
    <p className="text-muted">{t("servicesNote")}</p>
    {p.servicesReviewedAt && <p className="text-muted">{t("servicesChecked", { date: p.servicesReviewedAt.slice(0, 10) })}</p>}
    {p.serviceSources?.map((url, i) => <p key={url}><a href={url} target="_blank" rel="noopener noreferrer">{t("serviceSource", { number: i + 1 })}</a></p>)}
    <p>{p.insurances?.length ? `${t("insurance")}: ${p.insurances.map(s => t(`insurances.${s}`)).join(", ")}` : t("insuranceUnknown")}</p>
    {p.insuranceVerifiedAt && <p className="text-muted">{t("insuranceChecked", { date: p.insuranceVerifiedAt.slice(0, 10) })}</p>}
    <p className="text-muted">{t("insuranceNote")}</p>
    {p.insuranceSources?.map((url, i) => <p key={url}><a href={url} target="_blank" rel="noopener noreferrer">{t("insuranceSource", { number: i + 1 })}</a></p>)}
    <p>{feedback?.count ? t("ratingSummary", { rating: feedback.averageRating, count: feedback.count }) : t("noFeedback")}</p>
    <p><Badge tone="neutral">{t(`waiting.${waiting?.level || "unknown"}`)}</Badge></p>
    {waiting?.updatedAt && <p className="text-muted">{t("waitingUpdated", { date: new Date(waiting.updatedAt).toLocaleString("en-GB", { timeZone: "Asia/Beirut" }), count: waiting.reportCount })}</p>}
    <p className="text-muted">{t("waitingNote")}</p>
    {p.hoursKnown && <details><summary>{t("hoursTitle")}</summary>
      <ul>{p.hours.map((slot, i) => <li key={i}>{t(`day${slot.day}`)}: {time(slot.start)}\u2013{time(slot.end)} {slot.end < slot.start ? t("overnight") : ""}</li>)}</ul>
    </details>}
    <p className="text-muted">{t("hoursNote")}</p>
    {p.phone && <p><a href={`tel:${p.phone}`}>{t("call", { name: p.name })}</a></p>}
    {Number.isFinite(p.latitude) && Number.isFinite(p.longitude) ? <p><a className="button button--secondary" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${p.latitude},${p.longitude}`)}`} target="_blank" rel="noopener noreferrer">{t("directions")}</a></p> : <p>{t("locationUnknown")}</p>}
    <p className="text-muted">{t("checked", { date: p.verifiedAt.slice(0, 10) })}</p>
    <div className="provider-sources">{p.sources.map((url, i) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">{t("source", { number: i + 1 })}</a>)}</div>
  </>;
}
function time(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; }
