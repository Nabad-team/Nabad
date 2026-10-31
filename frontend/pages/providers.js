import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useSignedIn } from "../components/SessionTimeout";
import Card from "../components/ui/Card";
import Link from "next/link";
import ProviderFacts from "../components/ProviderFacts";
import { readProviderFilters, providerUrl } from "../lib/providerFilters";
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
  const router = useRouter();
  const signedIn = useSignedIn();
  const [draft, setDraft] = useState(readProviderFilters({}));
  const [favorites, setFavorites] = useState(null);
  const [favoriteError, setFavoriteError] = useState("");
  const [favoriteRetry, setFavoriteRetry] = useState(0);
  const [saving, setSaving] = useState(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    setFavorites(null); setFavoriteError("");
    if (!signedIn) return;
    getProviderFavorites().then(ids => { if (active) { setFavorites(ids); setFavoriteError(""); } })
      .catch(() => { if (active) setFavoriteError(t("favoritesError")); });
    return () => { active = false; };
  }, [favoriteRetry, signedIn]);
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
  function locate(rankEmergency = false) {
    const request = ++locationRequest.current;
    setLocationError(""); setLocating(true);
    const fail = () => { if (request === locationRequest.current) { setLocating(false); setLocationError(t("locationError")); } };
    if (!navigator.geolocation) return fail();
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== locationRequest.current) return;
      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      setLocation(coords); setLocating(false);
      if (rankEmergency) applyFilters({ ...filters, ...coords, page: 1 });
    }, fail, { timeout: 10000, maximumAge: 60000 });
  }
  const [filters, setFilters] = useState(null);
  useEffect(() => {
    if (!router.isReady) return;
    // A late GPS callback must not restore requirements from a previous search.
    locationRequest.current += 1;
    setLocating(false);
    const restored = readProviderFilters(router.query);
    setDraft(restored);
    // Coordinates are intentionally not read from or written to shareable URLs.
    setFilters(old => ({ ...restored, ...(old?.lat == null ? {} : { lat: old.lat, lng: old.lng, radiusKm: old.radiusKm }) }));
  }, [router.isReady, router.asPath]);
  function applyFilters(next) {
    setFilters(next);
    router.push(providerUrl(next), undefined, { shallow: true, scroll: false });
  }
  const [data, setData] = useState({ providers: [], specialties: [], cities: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const loadedFilters = useRef(null);
  // Refresh scheduled availability while the page remains open.
  useEffect(() => { const timer = setInterval(() => setRetry(value => value + 1), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!filters) return;
    const controller = new AbortController();
    let current = true;
    // Background status refresh must not hide the list or take focus away from its controls.
    if (loadedFilters.current !== filters) setLoading(true);
    loadedFilters.current = filters;
    setError("");
    getProviders({ ...filters, favorites: signedIn && filters.favorites }, controller.signal).then(result => { if (current) setData(result); })
      .catch(err => { if (current && err.name !== "AbortError") setError(t("loadError")); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [filters, retry, signedIn]);
  const field = key => ({ value: draft[key], onChange: e => setDraft(old => ({ ...old, [key]: e.target.value })) });
  return <PageLayout title={t("title")} header={<ProfileHeader showPicture={false} />}>
    <PageTitle lead={t("lead")}>{t("title")}</PageTitle>
    <p className="text-muted">{t("notice")}</p>
    {filters?.emergency24h && <Alert tone="danger">
      <p><a href="tel:140">{t("emergencyCall")}</a> {t("emergencyHelp")}</p>
      <p>{filters.emergencyNeeds ? t("emergencyMatching", { needs: filters.emergencyNeeds.split(",").map(id => t(`emergencyNeeds.${id}`)).join(", ") }) : t("emergencyGeneral")}</p>
      <p>{t("emergencyAvailability")}</p>
      <Button variant="secondary" disabled={locating} onClick={() => locate(true)}>{t(locating ? "locating" : "emergencyLocation")}</Button>
      {filters.lat == null && <p>{t("emergencyUnranked")}</p>}
      {locationError && <p role="alert">{locationError}</p>}
    </Alert>}
    <p className="text-muted">{t(signedIn ? "favoritesHint" : "publicHint")}</p>
    {notice && <p role="status">{notice}</p>}
    {favoriteError && <Alert tone="danger" role="alert"><p>{favoriteError}</p>
      {!favorites && <Button variant="secondary" onClick={() => setFavoriteRetry(value => value + 1)}>{t("retryFavorites")}</Button>}
    </Alert>}
    <form className="form provider-filters" onSubmit={event => { event.preventDefault(); applyFilters({ ...draft, ...(location || {}), page: 1 }); }}>
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
          {data.cities.map(city => <option key={city} value={city.toLowerCase()}>{city}</option>)}
        </select>
      </div>
      <details className="provider-filters__advanced">
        <summary>{t("moreFilters")}</summary>
        <div className="provider-filters__advanced-content">
          <div className="field"><label htmlFor="provider-district" className="field__label">{t("district")}</label>
            <select id="provider-district" className="input" {...field("district")}>
              <option value="">{t("allDistricts")}</option>
              {(data.districts || []).map(value => <option key={value} value={value.toLowerCase()}>{value}</option>)}
            </select>
            <p className="text-muted">{t("districtHint")}</p>
          </div>
          <div className="field"><label htmlFor="provider-governorate" className="field__label">{t("governorate")}</label>
            <select id="provider-governorate" className="input" {...field("governorate")}>
              <option value="">{t("allGovernorates")}</option>
              {(data.governorates || []).map(value => <option key={value} value={value.toLowerCase()}>{value}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="provider-service" className="field__label">{t("service")}</label>
            <select id="provider-service" className="input" {...field("service")}>
              <option value="">{t("allServices")}</option>
              {(data.services || []).map(value => <option key={value} value={value}>{t(`services.${value}`)}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="provider-insurance" className="field__label">{t("insurance")}</label>
            <select id="provider-insurance" className="input" {...field("insurance")}>
              <option value="">{t("allInsurance")}</option>
              {(data.insurances || []).map(value => <option key={value} value={value}>{t(`insurances.${value}`)}</option>)}
            </select>
            <p className="text-muted">{t("insuranceNote")}</p>
          </div>
          <p id="provider-location-hint">{t("locationHint")}</p>
          <div className="form-actions">
            <Button variant="secondary" disabled={locating} aria-describedby="provider-location-hint" onClick={() => locate()}>{t(locating ? "locating" : "location")}</Button>
            {(location || locating) && <Button variant="secondary" onClick={() => {
              locationRequest.current += 1; setLocation(null); setLocating(false); setLocationError("");
              setDraft(old => ({ ...old, radiusKm: "" }));
              applyFilters({ ...filters, lat: undefined, lng: undefined, radiusKm: "", page: 1 });
            }}>{t("clearLocation")}</Button>}
          </div>
          {!filters?.emergency24h && locationError && <p role="alert">{locationError}</p>}
          {location && <p role="status">{t("locationReady")}</p>}
          <div className="field"><label htmlFor="provider-radius" className="field__label">{t("radius")}</label>
            <select id="provider-radius" className="input" disabled={!location} {...field("radiusKm")}>
              <option value="">{t("anyDistance")}</option>
              {[5, 10, 25, 50, 100].map(km => <option key={km} value={km}>{t("within", { km })}</option>)}
            </select>
          </div>
          <label><input type="checkbox" checked={draft.openNow} onChange={e => setDraft(old => ({ ...old, openNow: e.target.checked }))} /> {t("openNow")}</label>
          <label><input type="checkbox" disabled={Boolean(draft.emergencyNeeds)} checked={draft.emergency24h} onChange={e => setDraft(old => ({ ...old, emergency24h: e.target.checked }))} /> {t("emergencyOnly")}</label>
          {signedIn && <label><input type="checkbox" checked={draft.favorites} onChange={e => setDraft(old => ({ ...old, favorites: e.target.checked }))} /> {t("favoritesOnly")}</label>}
        </div>
      </details>
      <Button type="submit">{t("submit")}</Button>
    </form>
    {loading ? <HeartbeatLoader label={t("loading")} /> : error ? <Alert tone="danger" role="alert">
      <p>{error}</p><Button variant="secondary" onClick={() => setRetry(value => value + 1)}>{t("retry")}</Button>
    </Alert> : <>
      <p role="status">{t("count", { count: data.total })}</p>
      <Button variant="secondary" aria-pressed={showMap} onClick={() => setShowMap(value => !value)}>{t(showMap ? "hideMap" : "showMap")}</Button>
      {showMap && <ProviderMap providers={data.providers} />}
      {!data.providers.length && <p>{t(filters.emergencyNeeds ? "emergencyNoMatch" : "empty")}</p>}
      <ul className="provider-list" aria-label={t("results")}>
        {data.providers.map((provider, index) => <Card as="li" className="provider-item" key={provider.id} id={`provider-${provider.id}`} tabIndex={-1}>
          {filters.emergencyNeeds && filters.lat != null && data.page === 1 && index === 0 && provider.distanceKm != null && <p role="status">{t("emergencyNearest")}</p>}
          <h2><Link href={`/providers/${provider.id}`}>{provider.name}</Link></h2>
          {signedIn ? <Button variant="secondary" disabled={!!saving || !favorites} aria-pressed={favorites?.includes(provider.id) || false}
            aria-label={t(favorites?.includes(provider.id) ? "unsave" : "save", { name: provider.name })}
            onClick={() => toggleFavorite(provider)}>{saving === provider.id ? t("saving") : t(favorites?.includes(provider.id) ? "unsaveButton" : "saveButton")}</Button> : <a className="button button--secondary" href="/login">{t("signInToSave")}</a>}
          <ProviderFacts provider={provider} />
        </Card>)}
      </ul>
      {data.total > (data.limit || 20) && <div className="form-actions">
        <Button variant="secondary" disabled={data.page <= 1} onClick={() => applyFilters({ ...filters, page: data.page - 1 })}>{t("previous")}</Button>
        <span>{t("page", { page: data.page })}</span>
        <Button variant="secondary" disabled={data.page * data.limit >= data.total} onClick={() => applyFilters({ ...filters, page: data.page + 1 })}>{t("next")}</Button>
      </div>}
    </>}
  </PageLayout>;
}
// Public browsing; only saved providers and contributions require authentication.
