import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/compat/router";
import Logo from "./Logo";
import Avatar from "./Avatar";
import Button from "./ui/Button";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { useSignedIn } from "./SessionTimeout";
import { signOut } from "../lib/session";
import { useAccessibility } from "../context/AccessibilityContext";
import { providerText } from "../lib/providerText";
import useDisclosure from "./useDisclosure";
import NotificationBell from "./NotificationBell";
import HeaderSearch from "./HeaderSearch";

// The main sections, in the order they appear. A new top-level page goes here.
// Each label is exactly the page's title, so people see the same name in the menu, the tab and the heading.
// (shortLabel is kept equal to label: the simplified mode used to show different words, which didn't match the titles.)
const link = (href, label, icon) => ({ href, label, shortLabel: label, icon });
export const MAIN_LINKS = [
  link("/symptoms", "Symptom check", "symptom"),
  link("/dashboard", "Dashboard", "dashboard"),
  link("/my-health", "My health", "health"),
  link("/vitals", "My vitals", "vitals"),
  link("/visit-prep", "Visit preparation", "summary"),
  link("/health-assistant", "Health assistant", "results"),
  link("/medications", "My medications", "medications"),
  link("/medication-overview", "Medication overview", "overview"),
  link("/appointments", "My appointments", "calendar"),
  link("/water-and-sleep", "Water and sleep", "wellbeing"),
  link("/providers", providerText("title"), "care"),
];
// Pages about the account itself, in the account menu.
export const ACCOUNT_LINKS = [
  { href: "/profile", label: "My profile", shortLabel: "My profile" },
  { href: "/security", label: "Account security", shortLabel: "Account security" },
  { href: "/care-circle", label: "Care circle", shortLabel: "Care circle" },
  { href: "/emergency-card", label: "Emergency information card", shortLabel: "Emergency information card" },
  { href: "/privacy", label: "Privacy Policy", shortLabel: "Privacy Policy" },
];

const DOCUMENT_LINK = link("/medical-documents", "My documents", "documents");
const WORKSPACE_LINKS = [...MAIN_LINKS.slice(0, -1), DOCUMENT_LINK, MAIN_LINKS[MAIN_LINKS.length - 1]];
const WORKSPACE_BY_HREF = new Map(WORKSPACE_LINKS.map((item) => [item.href, item]));
// The workspace navigation, in order: single links, and two groups that open as dropdowns on desktop.
// The phone menu shows the same items in the same order, with the groups as labelled card lists.
export const NAV_ITEMS = [
  { href: "/symptoms" },
  { href: "/dashboard" },
  { id: "my-care", label: "My care", links: ["/appointments", "/medications", "/medication-overview", "/water-and-sleep"] },
  { id: "my-records", label: "My records", links: ["/my-health", "/vitals", "/medical-documents", "/visit-prep"] },
  { href: "/health-assistant" },
  { href: "/providers" },
].map((item) => item.href ? WORKSPACE_BY_HREF.get(item.href) : { ...item, links: item.links.map((href) => WORKSPACE_BY_HREF.get(href)) });
export const WORKSPACE_GROUPS = NAV_ITEMS.filter((item) => item.links);

// Keep the current-page indicator in sync with client-side navigation.
function useCurrentPath() {
  const router = useRouter();
  const [path, setPath] = useState("");
  useEffect(() => { setPath(window.location.pathname); }, [router?.asPath]);
  return path;
}

function NavIcon({ name }) {
  const paths = {
    symptom: <><path d="M4 5h16v11H10l-4 4v-4H4Z" /><path d="M7 10.5h3l1.2-2.5 1.8 5 1.2-2.5H17" /></>,
    overview: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h10M7 17h6" /></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    health: <><path d="M12 20S4 15.4 4 9.2A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 8 2.2C20 15.4 12 20 12 20Z" /><path d="M8.5 12h2l1-2.5 1.5 5 1-2.5h1.5" /></>,
    vitals: <><path d="M3 12h4l2-5 4 10 2-5h6" /><path d="M4 4h16v16H4z" /></>,
    results: <><path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5M8 13h8M8 17h5" /><circle cx="17.5" cy="17.5" r="3.5" /><path d="m20 20 2 2" /></>,
    medications: <><path d="m8.5 4.5 11 11a3.5 3.5 0 0 1-5 5l-11-11a3.5 3.5 0 0 1 5-5Z" /><path d="m6 7 5 5M14 15l3 3" /></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" /></>,
    wellbeing: <><path d="M6 4v10M4 4v5a2 2 0 0 0 4 0V4M6 14v6" /><path d="M16 4v16M16 4c2.2 0 4 1.8 4 4v2h-4" /></>,
    documents: <><path d="M6 3h8l5 5v13H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5M8 12h8M8 16h8" /></>,
    summary: <><path d="M6 3h8l5 5v13H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5M8 12h8M8 16h5" /></>,
    care: <><circle cx="10.5" cy="10" r="3.5" /><path d="M4 20c.7-3.1 2.8-4.5 6.5-4.5S16.3 16.9 17 20M17 4v6M14 7h6" /></>,
  };
  return <svg className="app-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

function NavLinks({ links, path, className, simplified = false, cards = false, compact = false }) {
  return (
    <ul className={className}>
      {links.map(({ href, label, shortLabel, icon }) => (
        <li key={href}>
          <Link
            href={href}
            className={cards ? "app-nav__card" : undefined}
            aria-current={path === href ? "page" : undefined}
            aria-label={simplified || compact ? label : undefined}
          >
            {cards && <NavIcon name={icon} />}
            <span>{simplified || compact ? shortLabel : label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// A desktop dropdown ("My care", "My records"): a disclosure button, not an ARIA menu, so links stay links.
// Enter or Space opens it and focus moves to the first link; Down and Up move between links (Down/Up on the closed
// button opens it at the first/last link), Home and End jump; Escape closes it and returns to the button;
// clicking outside or tabbing out closes it. The group shows as current when one of its pages is open.
function NavGroup({ group, path }) {
  const disclosure = useDisclosure();
  const focusLast = useRef(false);
  const current = group.links.some((item) => item.href === path);
  const panelId = `nav-group-${group.id}`;

  useEffect(() => {
    if (disclosure.open && focusLast.current) {
      const links = disclosure.panelRef.current?.querySelectorAll("a");
      links?.[links.length - 1]?.focus();
    }
    focusLast.current = false;
  }, [disclosure.open, disclosure.panelRef]);

  function onButtonKeyDown(event) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (disclosure.open) {
      const links = [...(disclosure.panelRef.current?.querySelectorAll("a") || [])];
      (event.key === "ArrowDown" ? links[0] : links[links.length - 1])?.focus();
      return;
    }
    focusLast.current = event.key === "ArrowUp";
    disclosure.toggle();
  }

  function onPanelKeyDown(event) {
    const links = [...disclosure.panelRef.current.querySelectorAll("a")];
    const index = links.indexOf(document.activeElement);
    const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: links.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    links[(next + links.length) % links.length].focus();
  }

  return (
    <li className="nav-group">
      <button
        ref={disclosure.buttonRef}
        type="button"
        className={`nav-group__button${current ? " nav-group__button--current" : ""}`}
        aria-expanded={disclosure.open}
        aria-controls={panelId}
        aria-label={current ? `${group.label}, current section` : undefined}
        onClick={disclosure.toggle}
        onKeyDown={onButtonKeyDown}
      >
        {group.label}
        <svg className="nav-group__chevron" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
      </button>
      {disclosure.open && (
        <ul id={panelId} ref={disclosure.panelRef} className="nav-group__panel" onKeyDown={onPanelKeyDown}>
          {group.links.map(({ href, label, icon }) => (
            <li key={href}>
              <Link href={href} aria-current={path === href ? "page" : undefined} onClick={disclosure.close}>
                <NavIcon name={icon} />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// Desktop: one row. Phones: the same items as cards, the groups under their labels.
function WorkspaceLinks({ path, mobile = false }) {
  if (!mobile) {
    return <ul className="workspace-nav__list">
      {NAV_ITEMS.map((item) => item.links ? <NavGroup key={item.id} group={item} path={path} /> : (
        <li key={item.href}><Link href={item.href} aria-current={path === item.href ? "page" : undefined}>{item.label}</Link></li>
      ))}
    </ul>;
  }
  // Consecutive single links share one unlabelled card list; each group gets its label.
  const sections = [];
  for (const item of NAV_ITEMS) {
    if (item.links) sections.push(item);
    else if (sections.length && !sections[sections.length - 1].id) sections[sections.length - 1].links.push(item);
    else sections.push({ links: [item] });
  }
  return <div className="workspace-groups workspace-groups--mobile">
    {sections.map((section, index) => section.id ? (
      <section key={section.id} className="workspace-group" aria-labelledby={`workspace-mobile-${section.id}`}>
        <p id={`workspace-mobile-${section.id}`} className="workspace-group__label">{section.label}</p>
        <NavLinks links={section.links} path={path} className="mobile-menu__list mobile-menu__cards" cards />
      </section>
    ) : (
      <NavLinks key={`links-${index}`} links={section.links} path={path} className="mobile-menu__list mobile-menu__cards" cards />
    ))}
  </div>;
}

function ProfileSwitcher({ id, showLabel }) {
  const { selfProfile, linkedProfiles = [], activeProfile, switchProfile } = useActiveProfile() || {};
  if (!selfProfile || !activeProfile) return null;
  return (
    <div className="profile-switcher">
      {showLabel && <label htmlFor={id} className="field__label">Acting for</label>}
      <select
        id={id}
        aria-label={showLabel ? undefined : "Active profile"}
        className="input profile-select"
        value={activeProfile.id}
        onChange={(e) => switchProfile(e.target.value)}
      >
        <option value={selfProfile.id}>{selfProfile.fullName} (you)</option>
        {linkedProfiles.map((profile) => (
          <option key={profile.id} value={profile.id}>{profile.fullName} ({profile.relationship})</option>
        ))}
      </select>
    </div>
  );
}

// The signed-in header.
//   Desktop: logo and account controls, with the workspace navigation in one row below
//            (single links plus the "My care" and "My records" dropdowns).
//   Phones (under 40rem / 640px): logo, the notifications bell and a "Menu" button that opens a full-width panel
//            with everything else.
// The current page is marked with aria-current="page" (and highlighted) wherever its link appears.
export default function AppHeader() {
  const { selfProfile, activeProfile } = useActiveProfile() || {};
  const { preferences } = useAccessibility();
  const signedIn = useSignedIn();
  const path = useCurrentPath();
  const account = useDisclosure();
  const mobile = useDisclosure();
  const accountPage = ACCOUNT_LINKS.some((link) => link.href === path);

  return (
    <header className="site-header app-header">
      <div className="container container--wide app-header__bar">
        <Logo href={signedIn ? "/dashboard" : "/"} />
        {!signedIn && <nav aria-label="Public"><Link href="/providers">{providerText("title")}</Link></nav>}
        {signedIn && <HeaderSearch key={activeProfile?.id || "pending"} profileId={activeProfile?.id} profileName={activeProfile?.fullName} />}

        {signedIn && (
          <div className="app-header__end">
            <NotificationBell />
            <div className="app-header__account app-header__desktop">
              <ProfileSwitcher id="profile-switcher-desktop" />
              <div className="account-menu">
                <button
                  ref={account.buttonRef}
                  type="button"
                  className={`account-menu__button${accountPage ? " account-menu__button--current" : ""}`}
                  aria-expanded={account.open}
                  aria-controls="account-menu"
                  aria-label="Account menu"
                  onClick={account.toggle}
                >
                  <span aria-hidden="true" className="account-menu__avatar">
                    <Avatar name={selfProfile?.fullName} size={36} />
                  </span>
                  <svg className="account-menu__chevron" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                    <path d="M2.5 4.5 6 8l3.5-3.5" />
                  </svg>
                </button>
                {account.open && (
                  <div id="account-menu" ref={account.panelRef} className="account-menu__panel">
                    {selfProfile && (
                      <p className="account-menu__who">
                        <strong>{selfProfile.fullName}</strong>
                        {selfProfile.email && <span className="text-muted">{selfProfile.email}</span>}
                      </p>
                    )}
                    <nav aria-label="Account">
                      <NavLinks links={ACCOUNT_LINKS} path={path} className="account-menu__list" simplified={preferences.simplifiedMode} />
                    </nav>
                    <Button variant="secondary" size="small" block onClick={() => signOut()}>Sign out</Button>
                  </div>
                )}
              </div>
            </div>
            <Button
              ref={mobile.buttonRef}
              variant="secondary"
              size="small"
              className="app-header__menu-button"
              aria-expanded={mobile.open}
              aria-controls="mobile-menu"
              onClick={mobile.toggle}
            >
              Menu
            </Button>
          </div>
        )}
      </div>

      {signedIn && (
        <nav aria-label="Workspace" className="workspace-nav container container--wide">
          <WorkspaceLinks path={path} />
        </nav>
      )}

      {signedIn && mobile.open && (
        <div id="mobile-menu" ref={mobile.panelRef} className="mobile-menu">
          <div className="container">
            <nav aria-label="Main">
              <WorkspaceLinks path={path} mobile />
            </nav>
            <ProfileSwitcher id="profile-switcher-mobile" showLabel />
            <nav aria-label="Account">
              <NavLinks links={ACCOUNT_LINKS} path={path} className="mobile-menu__list" simplified={preferences.simplifiedMode} />
            </nav>
            <Button variant="secondary" block onClick={() => signOut()}>Sign out</Button>
          </div>
        </div>
      )}
    </header>
  );
}
