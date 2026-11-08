import { useEffect, useId, useRef, useState } from "react";
import Button from "./ui/Button";
import { searchNabad } from "../lib/searchApi";

const GROUPS = [["pages", "Pages"], ["medications", "Medications"], ["documents", "Documents"], ["appointments", "Appointments"], ["hospitals", "Hospitals"]];

// Ordinary links support Tab/Enter without trapping focus or pretending to be a listbox.
export default function HeaderSearch({ profileId, profileName }) {
  const id = useId();
  const root = useRef(null), input = useRef(null), panel = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const q = query.trim().replace(/\s+/g, " ");
  const current = response?.query === q && response.profileId === profileId ? response.data : null;

  useEffect(() => {
    if (q.length < 2 || !profileId) { setResponse(null); setError(false); return undefined; }
    const controller = new AbortController();
    setError(false);
    const timer = setTimeout(() => {
      searchNabad(profileId, q, controller.signal).then(data => {
        if (!controller.signal.aborted) setResponse({ query: q, profileId, data });
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, profileId, attempt]);

  useEffect(() => {
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("touchstart", outside);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("touchstart", outside);
      document.removeEventListener("focusin", outside);
    };
  }, []);

  const count = current ? GROUPS.reduce((sum, [key]) => sum + (current[key]?.items.length || 0), 0) : 0;
  return <div className="header-search" ref={root} onKeyDown={event => {
    if (event.key === "Escape") { input.current?.focus(); setOpen(false); }
    if (event.key === "ArrowDown" && event.target === input.current) {
      const first = panel.current?.querySelector("a");
      if (first) { event.preventDefault(); first.focus(); }
    }
  }}>
    <form role="search" aria-label="Search Nabad" className="header-search__form" onSubmit={event => {
      event.preventDefault(); setOpen(true); setAttempt(value => value + 1);
    }}>
      <label htmlFor={id} className="visually-hidden">Search Nabad</label>
      <input id={id} ref={input} className="input" type="search" value={query} maxLength={80} autoComplete="off"
        placeholder="Search pages and records" aria-describedby={`${id}-hint`} aria-controls={open ? `${id}-results` : undefined}
        onClick={() => setOpen(true)} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setError(false); setOpen(true); }} />
      <Button type="submit" variant="secondary" disabled={!profileId}>Search</Button>
    </form>
    <span id={`${id}-hint`} className="visually-hidden">Search pages, medications, documents, appointments and hospitals. Enter at least two characters. Use Tab or Down Arrow to reach results, and Escape to close.</span>
    {open && <section id={`${id}-results`} ref={panel} className="header-search__results" aria-label="Search results">
      <p className="text-muted text-sm">Records for {profileName || "the selected profile"}; pages and hospitals.</p>
      {q.length < 2 ? <p role="status">Enter at least 2 characters to search.</p>
        : error ? <><p role="alert">Search is unavailable. Please try again.</p><Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Retry search</Button></>
          : !current ? <p role="status">Searching...</p>
            : <>
              <p role="status">{count ? `${count} results shown.` : "No results found. Try a different name or page."}</p>
              {GROUPS.map(([key, label]) => current[key]?.items.length > 0 && <section key={key} aria-labelledby={`${id}-${key}`}>
                <h3 id={`${id}-${key}`}>{label}</h3>
                <ul>{current[key].items.map(result => <li key={result.href}>
                  <a href={result.href}>{result.label}</a>{result.detail && <span className="text-muted text-sm">{result.detail}</span>}
                </li>)}</ul>
                {current[key].hasMore && <p className="text-sm">More matches available. Refine your search.</p>}
              </section>)}
            </>}
      {query && <Button variant="secondary" size="small" onClick={() => { setQuery(""); setResponse(null); setError(false); input.current?.focus(); }}>Clear search</Button>}
    </section>}
  </div>;
}
