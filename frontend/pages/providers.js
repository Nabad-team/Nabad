import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useSignedIn } from "../components/SessionTimeout";
import Card from "../components/ui/Card";
import Link from "next/link";
import ProviderFacts, { ProviderBadges, ProviderCaveats, directionsUrl, hasMapLocation } from "../components/ProviderFacts";
import { readProviderFilters, providerUrl } from "../lib/providerFilters";
import ProfileHeader from "../components/ProfileHeader";
import PageLayout, { SiteHeader } from "../components/ui/PageLayout";
import HeldIcon from "../components/ui/HeldIcon";
import PageTitle from "../components/ui/PageTitle";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { ProvidersSkeleton } from "../components/ui/Skeleton";
import { getProviders, getProviderFavorites, setProviderFavorite, getProviderDrivingMinutes } from "../lib/providerApi";
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
  const [comparison, setComparison] = useState([]);
  function toggleComparison(provider) {
    setComparison(current => current.some(item => item.id === provider.id)
      ? current.filter(item => item.id !== provider.id)
      : current.length < 3 ? [...current, provider] : current);
  }
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
  function locate(rankEmergency = false, onLocated) {
    const request = ++locationRequest.current;
    setLocationError(""); setLocating(true);
    const fail = () => { if (request === locationRequest.current) { setLocating(false); setLocationError(t("locationError")); } };
    if (!navigator.geolocation) return fail();
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== locationRequest.current) return;
      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      setLocation(coords); setLocating(false);
      if (rankEmergency) applyFilters({ ...filters, ...coords, page: 1 });
      onLocated?.(coords);
    }, fail, { timeout: 10000, maximumAge: 60000 });
  }
  const [filters, setFilters] = useState(null);
  const [travelRequest, setTravelRequest] = useState(null);
  const [travel, setTravel] = useState(null);
  useEffect(() => {
    if (!travelRequest) return;
    const controller = new AbortController();
    getProviderDrivingMinutes(travelRequest.location, travelRequest.ids, controller.signal)
      .then(minutes => { if (!controller.signal.aborted) setTravel({ request: travelRequest, minutes }); })
      .catch(() => { if (!controller.signal.aborted) setTravel({ request: travelRequest, error: true }); });
    return () => controller.abort();
  }, [travelRequest]);
  function resetTravel() {
    setTravelRequest(null);
    setTravel(null);
  }
  useEffect(() => {
    if (!router.isReady) return;
    // A late GPS callback must not restore requirements from a previous search.
    locationRequest.current += 1;
    setLocating(false);
    resetTravel();
    const restored = readProviderFilters(router.query);
    setDraft(restored);
    // Coordinates are intentionally not read from or written to shareable URLs.
    setFilters(old => ({ ...restored, ...(old?.lat == null ? {} : { lat: old.lat, lng: old.lng, radiusKm: old.radiusKm }) }));
  }, [router.isReady, router.asPath]);
  function applyFilters(next) {
    locationRequest.current += 1;
    setLocating(false);
    resetTravel();
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
  const travelIds = data.providers.filter(provider =>
    !provider.locationApproximate && Number.isFinite(provider.latitude) && Number.isFinite(provider.longitude)
  ).map(provider => provider.id);
  const travelResults = travel?.request === travelRequest ? travel : null;
  const estimating = Boolean(travelRequest && !travelResults);
  function estimateTravel() {
    const start = coords => setTravelRequest({ location: coords, ids: travelIds });
    if (location) start(location);
    else locate(false, start);
  }
  const field = key => ({ value: draft[key], onChange: e => setDraft(old => ({ ...old, [key]: e.target.value })) });
  const categoryCount = data.typeCounts?.[filters?.type];
  const limitedCategory = Number.isInteger(categoryCount) && categoryCount < 10;
  const isSaved = (provider) => favorites?.includes(provider.id) || false;
  // Signed out: the landing page's header (Find care, Log in, Sign up). Signed in: the app's header.
  const header = signedIn ? <ProfileHeader /> : (
    <SiteHeader>
      <a href="/providers" className="site-nav__link" aria-current="page">Find care</a>
      <a href="/login" className="site-nav__link">Log in</a>
      <Button href="/signup" size="small">Sign up</Button>
    </SiteHeader>
  );
  return <PageLayout title={t("title")} header={header}>
    {/* Title and lead on the left; Use my location and Show map at the top right. */}
    <div className="providers-head">
      <PageTitle lead={t("lead")}>{t("title")}</PageTitle>
      <div className="providers-head__tools">
        <button type="button" className="quiet-button" disabled={locating} aria-describedby="provider-location-hint" onClick={() => locate()}>
          <HeldIcon name="location" size="1.25rem" />{t(locating ? "locating" : "location")}
        </button>
        {(location || locating) && <button type="button" className="quiet-button" onClick={() => {
          locationRequest.current += 1; setLocation(null); setLocating(false); setLocationError("");
          setDraft(old => ({ ...old, radiusKm: "" }));
          applyFilters({ ...filters, lat: undefined, lng: undefined, radiusKm: "", page: 1 });
        }}>{t("clearLocation")}</button>}
        <button type="button" className="quiet-button" aria-pressed={showMap} onClick={() => setShowMap(value => !value)}>
          <HeldIcon name="map" size="1.25rem" />{t(showMap ? "hideMap" : "showMap")}
        </button>
      </div>
    </div>
    {!filters?.emergency24h && locationError && <p role="alert">{locationError}</p>}
    {location && <p role="status" className="text-muted">{t("locationReady")}</p>}
    {filters?.emergency24h && <Alert tone="danger">
      <p><a href="tel:140">{t("emergencyCall")}</a> {t("emergencyHelp")}</p>
      <p>{filters.emergencyNeeds ? t("emergencyMatching", { needs: filters.emergencyNeeds.split(",").map(id => t(`emergencyNeeds.${id}`)).join(", ") }) : t("emergencyGeneral")}</p>
      <p>{t("emergencyAvailability")}</p>
      <Button variant="secondary" disabled={locating} onClick={() => locate(true)}>{t(locating ? "locating" : "emergencyLocation")}</Button>
      {filters.lat == null && <p>{t("emergencyUnranked")}</p>}
      {locationError && <p role="alert">{locationError}</p>}
    </Alert>}
    {notice && <p role="status">{notice}</p>}
    {favoriteError && <Alert tone="danger" role="alert"><p>{favoriteError}</p>
      {!favorites && <Button variant="secondary" onClick={() => setFavoriteRetry(value => value + 1)}>{t("retryFavorites")}</Button>}
    </Alert>}
    {/* The filters in one row above the results (never a side column, so desktop never has three columns), with the
        result count at its end. "More filters" opens a panel under the row. */}
    <form className="provider-filters" aria-label={t("filtersLabel")} onSubmit={event => {
      event.preventDefault();
      applyFilters({ ...draft, type: draft.emergency24h ? "" : draft.type, ...(location || {}), page: 1 });
    }}>
      <div className="provider-filters__row">
        <Input id="provider-search" label={t("search")} maxLength={100} {...field("q")} />
        <div className="field"><label htmlFor="provider-type" className="field__label">{t("facilityType")}</label>
          <select id="provider-type" className="input" disabled={draft.emergency24h} {...field("type")}>
            <option value="">{t("allFacilityTypes")}</option>
            {["hospital", "clinic", "laboratory", "imaging-center"].map(type => <option key={type} value={type}>{t(type)}</option>)}
          </select>
        </div>
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
        <Button type="submit" className="provider-filters__submit">{t("submit")}</Button>
      </div>
      <div className="provider-filters__toggles">
        <label className="check"><input type="checkbox" disabled={Boolean(draft.emergencyNeeds)} checked={draft.emergency24h} onChange={e => setDraft(old => ({ ...old, emergency24h: e.target.checked }))} /> <span>{t("emergencyOnly")}</span></label>
        <label className="check"><input type="checkbox" checked={draft.openNow} onChange={e => setDraft(old => ({ ...old, openNow: e.target.checked }))} /> <span>{t("openNow")}</span></label>
        {signedIn && <label className="check"><input type="checkbox" checked={draft.favorites} onChange={e => setDraft(old => ({ ...old, favorites: e.target.checked }))} /> <span>{t("favoritesOnly")}</span></label>}
        {!loading && !error && <p role="status" className="provider-filters__count">{t("count", { count: data.total })}</p>}
      </div>
      <details className="provider-filters__advanced">
        <summary>{t("moreFilters")}<HeldIcon name="chevronDown" size="1.125rem" className="provider-filters__chevron" /></summary>
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
          <div className="field"><label htmlFor="provider-radius" className="field__label">{t("radius")}</label>
            <select id="provider-radius" className="input" disabled={!location} {...field("radiusKm")}>
              <option value="">{t("anyDistance")}</option>
              {[5, 10, 25, 50, 100].map(km => <option key={km} value={km}>{t("within", { km })}</option>)}
            </select>
            <p id="provider-location-hint" className="text-muted">{t("locationHint")}</p>
          </div>
        </div>
      </details>
    </form>
    <div className="providers-results">
    {loading ? <ProvidersSkeleton label={t("loading")} /> : error ? <Alert tone="danger" role="alert">
      <p>{error}</p><Button variant="secondary" onClick={() => setRetry(value => value + 1)}>{t("retry")}</Button>
    </Alert> : <>
      {/* Said once: one muted line, the same notes in full under "About this data". */}
      <div className="provider-notes">
        <p className="text-muted provider-notes__line">{t("dataLine")}{" "}</p>
        <details className="provider-notes__about">
          <summary>{t("aboutData")}<HeldIcon name="chevronDown" size="1rem" className="provider-filters__chevron" /></summary>
          <p className="text-muted provider-directory-note">{t("resultsNote")}</p>
          {limitedCategory && <p className="text-muted">{t("limitedCoverage", {
            category: t(filters.type), count: categoryCount, listings: categoryCount === 1 ? "listing" : "listings",
          })}</p>}
          <p className="text-muted provider-saved-note">{t(signedIn ? "favoritesHint" : "publicHint")}</p>
          {!filters.emergency24h && travelIds.length > 0 && <p id="provider-travel-hint" className="text-muted">{t("travelHint")}</p>}
        </details>
      </div>
      {!filters.emergency24h && travelIds.length > 0 && <div className="provider-tools">
        <button type="button" className="quiet-button" disabled={locating || estimating}
          aria-describedby="provider-travel-hint" onClick={estimateTravel}>{t(estimating ? "travelLoading" : "travelButton")}</button>
      </div>}
      {!filters.emergency24h && travelIds.length > 0 && travelResults && <p role="status">{t(travelResults.error ? "travelError" : "travelReady")}</p>}
      {showMap && <ProviderMap providers={data.providers} />}
      {!data.providers.length && <p>{t(filters.emergencyNeeds ? "emergencyNoMatch" : "empty")}</p>}
      {comparison.length > 0 && <Card as="section" aria-labelledby="provider-comparison">
        <h2 id="provider-comparison">{t("compareTitle")}</h2>
        <p role="status">{t("compareCount", { count: comparison.length })}</p>
        <Button variant="secondary" onClick={() => setComparison([])}>{t("compareClear")}</Button>
        <div className="provider-comparison">
          {comparison.map(saved => {
            const current = data.providers.find(item => item.id === saved.id);
            const provider = current || { ...saved, distanceKm: null };
            return <section key={provider.id} aria-label={provider.name}>
              <h3><Link href={`/providers/${provider.id}`}>{provider.name}</Link></h3>
              <Button variant="secondary" aria-label={t("compareRemoveName", { name: provider.name })}
                onClick={() => toggleComparison(provider)}>{t("compareRemove")}</Button>
              <ProviderFacts provider={provider} showLiveStatus={Boolean(current)}
                drivingMinutes={travelResults?.minutes?.[provider.id]} />
            </section>;
          })}
        </div>
      </Card>}
      <ul className="provider-list" aria-label={t("results")}>
        {data.providers.map((provider, index) => {
          const comparing = comparison.some(item => item.id === provider.id);
          const drivingMinutes = travelResults?.minutes?.[provider.id];
          const canDirect = hasMapLocation(provider);
          // ONE primary action: Directions once your location is known, otherwise Call. The other is an icon button.
          const directionsFirst = Boolean(canDirect && (location || !provider.phone));
          const callAction = !provider.phone ? null : (primary => <a className={primary ? "button button--primary button--small" : "icon-button"}
            href={`tel:${provider.phone}`} aria-label={t("call", { name: provider.name })}>
            <HeldIcon name="phone" size="1.25rem" />{primary && t("callShort")}</a>);
          const directionsAction = !canDirect ? null : (primary => <a className={primary ? "button button--primary button--small" : "icon-button"}
            href={directionsUrl(provider)} target="_blank" rel="noopener noreferrer" aria-label={t("directionsTo", { name: provider.name })}>
            <HeldIcon name="directions" size="1.25rem" />{primary && t("directionsShort")}</a>);
          const saved = isSaved(provider);
          // The card: the name (the link to every detail), type, city and distance, status chips, then the actions.
          return <Card as="li" className="provider-item provider-card" key={provider.id} id={`provider-${provider.id}`} tabIndex={-1}>
            {filters.emergencyNeeds && filters.lat != null && data.page === 1 && index === 0 && provider.distanceKm != null && <p role="status">{t("emergencyNearest")}</p>}
            <Link href={`/providers/${provider.id}`} className="provider-card__header">
              <h2 className="provider-card__name">{provider.name}</h2>
              <HeldIcon name="chevronRight" size="1.25rem" className="provider-card__chevron" />
            </Link>
            <p className="provider-card__meta">{t(provider.type)}{provider.city ? ` · ${provider.city}` : ""}{provider.distanceKm != null ? ` · ${t("distance", { km: provider.distanceKm })}` : ""}</p>
            <ProviderBadges provider={provider} drivingMinutes={drivingMinutes} card />
            <ProviderCaveats provider={provider} />
            <div className="provider-card__actions">
              {directionsFirst ? directionsAction(true) : callAction?.(true)}
              {directionsFirst ? callAction?.(false) : directionsAction?.(false)}
              {signedIn ? <button type="button" className="icon-button" disabled={!!saving || !favorites} aria-pressed={saved}
                aria-label={t(saved ? "unsave" : "save", { name: provider.name })}
                onClick={() => toggleFavorite(provider)}><HeldIcon name={saved ? "bookmarkFilled" : "bookmark"} size="1.25rem" /></button>
                : <a className="icon-button" href="/login" aria-label={t("signInToSaveName", { name: provider.name })}><HeldIcon name="bookmark" size="1.25rem" /></a>}
              <label className="check provider-card__compare">
                <input type="checkbox" checked={comparing} disabled={!comparing && comparison.length === 3} onChange={() => toggleComparison(provider)}
                  aria-label={t("compareName", { name: provider.name })} />
                <span aria-hidden="true">{t("compareAdd")}</span>
              </label>
            </div>
          </Card>;
        })}
      </ul>
      {data.total > (data.limit || 20) && <div className="form-actions">
        <Button variant="secondary" disabled={data.page <= 1} onClick={() => applyFilters({ ...filters, page: data.page - 1 })}>{t("previous")}</Button>
        <span>{t("page", { page: data.page })}</span>
        <Button variant="secondary" disabled={data.page * data.limit >= data.total} onClick={() => applyFilters({ ...filters, page: data.page + 1 })}>{t("next")}</Button>
      </div>}
    </>}
    </div>
  </PageLayout>;
}
// Public browsing; only saved providers and contributions require authentication.
