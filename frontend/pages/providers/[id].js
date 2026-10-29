import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSignedIn } from "../../components/SessionTimeout";
import ProfileHeader from "../../components/ProfileHeader";
import PageLayout from "../../components/ui/PageLayout";
import PageTitle from "../../components/ui/PageTitle";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";
import { HeartbeatLoader } from "../../components/ui/Heartbeat";
import ProviderFacts from "../../components/ProviderFacts";
import { getProvider, getMyProviderFeedback, saveProviderFeedback, removeProviderFeedback,
  getMyProviderCorrections, reportProviderCorrection, removeProviderCorrection } from "../../lib/providerApi";
const emptyFeedback = () => ({ rating: "5", visitDate: "", note: "", waitLevel: "", recentVisit: false });
const reportFields = { name: "Name", location: "Location or address", phone: "Telephone",
  hours: "Opening hours or emergency status", insurance: "Insurance", services: "Services or equipment", other: "Other" };
export default function ProviderDetailPage() {
  const router = useRouter(), signedIn = useSignedIn();
  const id = typeof router.query.id === "string" ? router.query.id : null;
  const [provider, setProvider] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [retry, setRetry] = useState(0), [mineRetry, setMineRetry] = useState(0);
  const [form, setForm] = useState(emptyFeedback), [hasFeedback, setHasFeedback] = useState(false);
  const [reports, setReports] = useState([]), [report, setReport] = useState({ field: "phone", details: "" });
  const [mineReady, setMineReady] = useState(false), [mineError, setMineError] = useState("");
  const [busy, setBusy] = useState(""), [actionError, setActionError] = useState(""), [notice, setNotice] = useState("");
  const [origin, setOrigin] = useState(""), [summaryError, setSummaryError] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!router.isReady) return;
    if (!id || !/^[a-z0-9-]{1,100}$/.test(id)) { setError("Provider not found."); setLoading(false); return; }
    const controller = new AbortController(); let current = true;
    setLoading(true); setProvider(null); setError(""); setNotice(""); setActionError("");
    getProvider(id, controller.signal).then(p => { if (current) setProvider(p); })
      .catch(e => { if (current && e.name !== "AbortError") setError(e.status === 404 ? "Provider not found." : "We could not load this provider. Please try again."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [router.isReady, id, retry]);
  useEffect(() => {
    setMineReady(false); setMineError(""); setForm(emptyFeedback()); setHasFeedback(false); setReports([]);
    if (!signedIn || !provider?.id) return;
    const controller = new AbortController(); let current = true;
    Promise.all([getMyProviderFeedback(provider.id, controller.signal), getMyProviderCorrections(provider.id, controller.signal)])
      .then(([feedback, ownReports]) => {
        if (!current) return;
        if (feedback) { setForm({ ...emptyFeedback(), rating: String(feedback.rating), visitDate: feedback.visitDate, note: feedback.note || "" }); setHasFeedback(true); }
        setReports(ownReports); setMineReady(true);
      }).catch(e => { if (current && e.name !== "AbortError") setMineError("We could not load your contributions. Retry before making changes."); });
    return () => { current = false; controller.abort(); };
  }, [signedIn, provider?.id, mineRetry]);
  useEffect(() => {
    if (!provider?.id) return;
    const controller = new AbortController(); let current = true;
    const timer = setInterval(() => {
      getProvider(provider.id, controller.signal).then(p => { if (current) { setProvider(p); setSummaryError(""); } })
        .catch(e => {
          if (!current || e.name === "AbortError") return;
          setSummaryError("Recent waiting reports could not refresh. Call the facility for current information.");
          setProvider(old => old ? { ...old, feedback: { ...old.feedback, waiting: { level: "unknown", reportCount: 0 } } } : old);
        });
    }, 60000);
    return () => { current = false; clearInterval(timer); controller.abort(); };
  }, [provider?.id]);
  async function refreshSummary() {
    try { setProvider(await getProvider(provider.id)); }
    catch { setActionError("Your change was saved, but the public summary could not refresh. Reload this page to check it."); }
  }
  async function submitFeedback(event) {
    event.preventDefault(); if (!mineReady || busy) return;
    setBusy("feedback"); setActionError(""); setNotice("");
    try {
      await saveProviderFeedback(provider.id, { ...form, rating: Number(form.rating),
        ...(form.waitLevel ? {} : { recentVisit: false }) });
      setHasFeedback(true); setForm(old => ({ ...old, waitLevel: "", recentVisit: false }));
      setNotice("Your visit feedback was saved. Only aggregate ratings and recent waiting levels are public.");
      await refreshSummary();
    } catch (e) { setActionError(e.message || "Feedback could not be saved."); }
    finally { setBusy(""); }
  }
  async function deleteFeedback() {
    if (!mineReady || busy) return;
    setBusy("feedback"); setActionError(""); setNotice("");
    try {
      await removeProviderFeedback(provider.id); setHasFeedback(false); setForm(emptyFeedback());
      setNotice("Your feedback and its waiting report were removed."); await refreshSummary();
    } catch (e) { setActionError(e.message || "Feedback could not be removed."); }
    finally { setBusy(""); }
  }
  async function submitReport(event) {
    event.preventDefault(); if (!mineReady || busy) return;
    setBusy("report"); setActionError(""); setNotice("");
    try {
      const result = await reportProviderCorrection(provider.id, report);
      setReports(old => [{ ...report, status: result.status, updatedAt: new Date().toISOString() }, ...old.filter(r => r.field !== report.field)]);
      setReport(old => ({ ...old, details: "" }));
      setNotice(result.message);
    } catch (e) { setActionError(e.message || "Your report could not be saved."); }
    finally { setBusy(""); }
  }
  async function withdrawReport(field) {
    if (busy || !mineReady) return;
    setBusy("report"); setActionError(""); setNotice("");
    try { await removeProviderCorrection(provider.id, field); setReports(old => old.filter(r => r.field !== field)); setNotice("Your report was withdrawn."); }
    catch (e) { setActionError(e.message || "Your report could not be withdrawn."); }
    finally { setBusy(""); }
  }
  const shareUrl = provider ? origin + "/providers/" + encodeURIComponent(provider.id) : "";
  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); setNotice("Provider link copied."); }
    catch { setNotice("Copy the shareable link shown below."); }
  }
  const control = key => ({ value: form[key], onChange: e => setForm(old => ({ ...old, [key]: e.target.value })) });
  return <PageLayout title={provider?.name || "Provider details"} header={<ProfileHeader showPicture={false} />}>
    <Button href="/providers" variant="secondary">Back to providers</Button>
    {loading ? <HeartbeatLoader label="Loading provider details" /> : error ? <Alert tone="danger" role="alert">
      <p>{error}</p><Button variant="secondary" onClick={() => setRetry(n => n + 1)}>Try again</Button>
    </Alert> : provider && <>
      <PageTitle lead="Published facility information and community visit reports.">{provider.name}</PageTitle>
      <p className="text-muted">Call to confirm services and coverage before travelling. In an emergency in Lebanon, call 140; do not wait for online reports.</p>
      {notice && <p role="status">{notice}</p>}
      {actionError && <Alert tone="danger" role="alert">{actionError}</Alert>}
      {summaryError && <Alert tone="warning" role="status">{summaryError}</Alert>}
      <Card><h2>Facility details</h2><ProviderFacts provider={provider} /></Card>
      <Card><h2>Share this provider</h2>
        <Input id="provider-share" label="Shareable link" readOnly value={shareUrl} />
        <Button variant="secondary" onClick={copyLink}>Copy provider link</Button>
      </Card>
      {!signedIn ? <p><Button href="/login" variant="secondary">Sign in to leave feedback or report an error</Button></p> : <>
        {mineError && <Alert tone="danger" role="alert"><p>{mineError}</p><Button variant="secondary" onClick={() => setMineRetry(n => n + 1)}>Retry my contributions</Button></Alert>}
        {!mineReady && !mineError && <p role="status">Loading your contributions...</p>}
        <Card><h2>Your visit feedback</h2>
          <p>One current review per account and facility; saving again replaces your review. Ratings are self-reported experiences, not verified measures of clinical quality.</p>
          <form className="form" onSubmit={submitFeedback}>
            <Input id="feedback-rating" label="Visit rating" as="select" required {...control("rating")}>
              {[5, 4, 3, 2, 1].map(n => <option key={n} value={String(n)}>{n} out of 5</option>)}
            </Input>
            <Input id="feedback-date" label="Visit date" type="date" required {...control("visitDate")} />
            <Input id="feedback-note" label="Private feedback note (optional)" hint="Your note is visible to you and the directory team, not other visitors. Do not include names, contact details or medical information." as="textarea" maxLength={1000} {...control("note")} />
            <Input id="feedback-wait" label="Waiting level observed (optional)" as="select" {...control("waitLevel")}>
              <option value="">Do not submit a waiting report</option><option value="short">Short: under 30 minutes</option>
              <option value="moderate">Moderate: 30 to 60 minutes</option><option value="long">Long: over 60 minutes</option>
            </Input>
            {form.waitLevel && <label><input type="checkbox" required checked={form.recentVisit} onChange={e => setForm(old => ({ ...old, recentVisit: e.target.checked }))} /> I observed this waiting level at this facility within the last two hours.</label>}
            <p className="text-muted">Waiting reports expire after two hours and need at least three accounts before a level is shown. Saving without a fresh waiting report removes your previous waiting observation.</p>
            <div className="form-actions"><Button type="submit" disabled={!mineReady || !!busy}>{busy === "feedback" ? "Saving..." : "Save visit feedback"}</Button>
              {hasFeedback && <Button variant="danger" disabled={!mineReady || !!busy} onClick={deleteFeedback}>Remove my feedback</Button>}</div>
          </form>
        </Card>
        <Card><h2>Report incorrect information</h2>
          <p>Reports are private suggestions for the directory team. A report does not automatically change the published listing. Do not send patient details.</p>
          <form className="form" onSubmit={submitReport}>
            <Input id="correction-field" label="Information to correct" as="select" value={report.field} onChange={e => setReport(old => ({ ...old, field: e.target.value }))}>
              {Object.entries(reportFields).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Input>
            <Input id="correction-details" label="Correction details" hint="Describe the problem and, if available, include an official source URL. Submitting again for the same field replaces your report." as="textarea" required maxLength={1000} value={report.details} onChange={e => setReport(old => ({ ...old, details: e.target.value }))} />
            <Button type="submit" disabled={!mineReady || !!busy}>{busy === "report" ? "Saving..." : "Send correction report"}</Button>
          </form>
          {reports.length > 0 && <><h3>Your reports</h3><ul>{reports.map(r => <li key={r.field}>
            <p>{reportFields[r.field]}: {r.details}</p><p>Status: {r.status === "reviewed" ? "Reviewed" : "Pending review"}</p>
            <Button variant="secondary" disabled={!!busy || !mineReady} onClick={() => withdrawReport(r.field)}>Withdraw {reportFields[r.field].toLowerCase()} report</Button>
          </li>)}</ul></>}
        </Card>
      </>}
    </>}
  </PageLayout>;
}
