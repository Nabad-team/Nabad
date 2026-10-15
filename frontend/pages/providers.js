import { useEffect, useRef, useState } from "react";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout from "../components/ui/PageLayout";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { HeartbeatLoader } from "../components/ui/Heartbeat";
import { getProviders, getProviderFavorites, setProviderFavorite } from "../lib/providerApi";
import { providerText as t } from "../lib/providerText";
import ProviderMap from "../components/ProviderMap";

export default function ProvidersPage() {
  const [draft, setDraft] = useState({ q: "", specialty: "", city: "", radiusKm: "", openNow: false, emergency24h: false, favorites: false });
  const [favorites, setFavorites] = useState(null);
  const [favoriteError, setFavoriteError] = useState("");
  const [favoriteRetry, setFavoriteRetry] = useState(0);
  const [saving, setSaving] = useState(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    getProviderFavorites().then(ids => { if (active) { setFavorites(ids); setFavoriteError(""); } })
      .catch(() => { if (active) setFavoriteError(t("favoritesError")); });
    return () => { active = false; };
  }, [favoriteRetry]);
  async function toggleFavorite(provider) {
    if (saving || !favorites) return;
    const add = !favorites.includes(provider.id);
    setSaving(provider.id); setFavoriteError(""); setNotice("");
    try {
      await setProviderFavorite(provider.id, add);
      setFavorites(old => add ? [...new Set([...old, provider.id])] : old.filter(id => id !== provider.id));
      setNotice(t(add ? "saved" : "removed", { name: provider.name }));
      if (filters.favorites) setRetry(value => value + 1);
    } catch (error) { setFavoriteError(t(error.status === 409 ? "favoriteLimit" : "favoriteError")); }
    finally { setSaving(null); }
  }
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const locationRequest = useRef(0);
  useEffect(() => () => { locationRequest.current += 1; }, []);
  function locate() {
    const request = ++locationRequest.current;
    setLocationError(""); setLocating(true);
    const fail = () => { if (request === locationRequest.current) { setLocating(false); setLocationError(t("locationError")); } };
    if (!navigator.geolocation) return fail();
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== locationRequest.current) return;
      setLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); setLocating(false);
    }, fail, { timeout: 10000, maximumAge: 60000 });
  }
  const [filters, setFilters] = useState({});
  const [data, setData] = useState({ providers: [], specialties: [], cities: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const loadedFilters = useRef(null);
  // Refresh scheduled availability while the page remains open.
  useEffect(() => { const timer = setInterval(() => setRetry(value => value + 1), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    // Background status refresh must not hide the list or take focus away from its controls.
    if (loadedFilters.current !== filters) setLoading(true);
    loadedFilters.current = filters;
    setError("");
    getProviders(filters, controller.signal).then(result => { if (current) setData(result); })
      .catch(err => { if (current && err.name !== "AbortError") setError(t("loadError")); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [filters, retry]);
  const field = key => ({ value: draft[key], onChange: e => setDraft(old => ({ ...old, [key]: e.target.value })) });
  return <PageLayout title={t("title")} header={<ProfileHeader showPicture={false} />}>
    <PageTitle lead={t("lead")}>{t("title")}</PageTitle>
    <p className="text-muted">{t("notice")}</p>
    <p className="text-muted">{t("favoritesHint")}</p>
    {notice && <p role="status">{notice}</p>}
    {favoriteError && <Alert tone="danger" role="alert"><p>{favoriteError}</p>
      {!favorites && <Button variant="secondary" onClick={() => setFavoriteRetry(value => value + 1)}>{t("retryFavorites")}</Button>}
    </Alert>}
    <form className="form provider-filters" onSubmit={event => { event.preventDefault(); setFilters({ ...draft, ...(location || {}), page: 1 }); }}>
      <Input id="provider-search" label={t("search")} maxLength={100} {...field("q")} />
      <div className="field"><label htmlFor="provider-specialty" className="field__label">{t("specialty")}</label>
        <select id="provider-specialty" className="input" {...field("specialty")}>
          <option value="">{t("allSpecialties")}</option>
          {data.specialties.map(value => <option key={value} value={value}>{t(`specialties.${value}`)}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="provider-city" className="field__label">{t("city")}</label>
        <select id="provider-city" className="input" {...field("city")}>
          <option value="">{t("allCities")}</option>
          {data.cities.map(city => <option key={city} value={city}>{city}</option>)}
        </select>
      </div>
      <p id="provider-location-hint">{t("locationHint")}</p>
      <div className="form-actions">
        <Button variant="secondary" disabled={locating} aria-describedby="provider-location-hint" onClick={locate}>{t(locating ? "locating" : "location")}</Button>
        {(location || locating) && <Button variant="secondary" onClick={() => {
          locationRequest.current += 1; setLocation(null); setLocating(false); setLocationError("");
          setDraft(old => ({ ...old, radiusKm: "" }));
          setFilters(old => ({ ...old, lat: undefined, lng: undefined, radiusKm: "", page: 1 }));
        }}>{t("clearLocation")}</Button>}
      </div>
      {locationError && <p role="alert">{locationError}</p>}
      {location && <p role="status">{t("locationReady")}</p>}
      <div className="field"><label htmlFor="provider-radius" className="field__label">{t("radius")}</label>
        <select id="provider-radius" className="input" disabled={!location} {...field("radiusKm")}>
          <option value="">{t("anyDistance")}</option>
          {[5, 10, 25, 50, 100].map(km => <option key={km} value={km}>{t("within", { km })}</option>)}
        </select>
      </div>
      <label><input type="checkbox" checked={draft.openNow} onChange={e => setDraft(old => ({ ...old, openNow: e.target.checked }))} /> {t("openNow")}</label>
      <label><input type="checkbox" checked={draft.emergency24h} onChange={e => setDraft(old => ({ ...old, emergency24h: e.target.checked }))} /> {t("emergencyOnly")}</label>
      <label><input type="checkbox" checked={draft.favorites} onChange={e => setDraft(old => ({ ...old, favorites: e.target.checked }))} /> {t("favoritesOnly")}</label>
      <Button type="submit">{t("submit")}</Button>
    </form>
    {loading ? <HeartbeatLoader label={t("loading")} /> : error ? <Alert tone="danger" role="alert">
      <p>{error}</p><Button variant="secondary" onClick={() => setRetry(value => value + 1)}>{t("retry")}</Button>
    </Alert> : <>
      <p role="status">{t("count", { count: data.total })}</p>
      <Button variant="secondary" aria-pressed={showMap} onClick={() => setShowMap(value => !value)}>{t(showMap ? "hideMap" : "showMap")}</Button>
      {showMap && <ProviderMap providers={data.providers} />}
      {!data.providers.length && <p>{t("empty")}</p>}
      <ul className="provider-list" aria-label={t("results")}>
        {data.providers.map(provider => <li className="provider-item" key={provider.id} id={`provider-${provider.id}`} tabIndex={-1}>
          <h2>{provider.name}</h2>
          <Button variant="secondary" disabled={!!saving || !favorites} aria-pressed={favorites?.includes(provider.id) || false}
            aria-label={t(favorites?.includes(provider.id) ? "unsave" : "save", { name: provider.name })}
            onClick={() => toggleFavorite(provider)}>{saving === provider.id ? t("saving") : t(favorites?.includes(provider.id) ? "unsaveButton" : "saveButton")}</Button>
          <p>{t(provider.type)} · {provider.city}</p><p>{provider.address}</p>
          {provider.distanceKm != null && <p>{t("distance", { km: provider.distanceKm })}</p>}
          {provider.locationApproximate && <p>{t("approximatePin")}</p>}
          <p>{provider.specialties.length ? provider.specialties.map(s => t(`specialties.${s}`)).join(", ") : t("specialtiesUnknown")}</p>
          <p>{t(provider.openingStatus || "unknown")}</p>
          <p>{t(provider.emergency24h === true ? "erYes" : provider.emergency24h === false ? "erNo" : "erUnknown")}</p>
          {provider.hoursKnown && <details><summary>{t("hoursTitle")}</summary>
            <ul>{provider.hours.map((slot, index) => <li key={index}>{t(`day${slot.day}`)}: {formatTime(slot.start)}–{formatTime(slot.end)} {slot.end < slot.start ? t("overnight") : ""}</li>)}</ul>
          </details>}
          <p className="text-muted">{t("hoursNote")}</p>
          {provider.phone && <p><a href={`tel:${provider.phone}`}>{t("call", { name: provider.name })}</a></p>}
          <p className="text-muted">{t("checked", { date: provider.verifiedAt.slice(0, 10) })}</p>
          <div className="provider-sources">{provider.sources.map((source, index) => <a key={source} href={source} target="_blank" rel="noopener noreferrer">{t("source", { number: index + 1 })}</a>)}</div>
        </li>)}
      </ul>
      {data.total > (data.limit || 20) && <div className="form-actions">
        <Button variant="secondary" disabled={data.page <= 1} onClick={() => setFilters(old => ({ ...old, page: data.page - 1 }))}>{t("previous")}</Button>
        <span>{t("page", { page: data.page })}</span>
        <Button variant="secondary" disabled={data.page * data.limit >= data.total} onClick={() => setFilters(old => ({ ...old, page: data.page + 1 }))}>{t("next")}</Button>
      </div>}
    </>}
  </PageLayout>;
}
ProvidersPage.requireSignIn = true;
function formatTime(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; }
