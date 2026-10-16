import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import Avatar from "./Avatar";
import Button from "./ui/Button";
import { useActiveProfile } from "../context/ActiveProfileContext";
import { useSignedIn } from "./SessionTimeout";
import { signOut } from "../lib/session";
import { useAccessibility } from "../context/AccessibilityContext";
import { providerText } from "../lib/providerText";

// The main sections, in the order they appear. A new top-level page goes here.
export const MAIN_LINKS = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: "dashboard" },
  { href: "/my-health", label: "My health", shortLabel: "Health", icon: "health" },
  { href: "/medications", label: "Medications", shortLabel: "Medicines", icon: "medications" },
  { href: "/water-and-sleep", label: "Water and sleep", shortLabel: "Water & sleep", icon: "wellbeing" },
  { href: "/providers", label: providerText("title"), shortLabel: providerText("title"), icon: "care" },
];
// Pages about the account itself, in the account menu.
export const ACCOUNT_LINKS = [
  { href: "/profile", label: "My profile", shortLabel: "Profile" },
  { href: "/security", label: "Security", shortLabel: "Security" },
];

// A button that shows and hides a panel (the "disclosure" pattern, which suits navigation links better
// than an ARIA menu). Opening moves focus to the first link or control in the panel. Escape closes it and
// puts focus back on the button. Clicking outside, or tabbing out of the panel, closes it too.
function useDisclosure() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.querySelector("a, button, select")?.focus();
    const inside = (node) => buttonRef.current?.contains(node) || panelRef.current?.contains(node);
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointerDown(event) {
      if (!inside(event.target)) setOpen(false);
    }
    function onFocusIn(event) {
      if (!inside(event.target)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  return { open, toggle: () => setOpen((value) => !value), buttonRef, panelRef };
}

// The page we are on, for aria-current. Every link here is a full page load, so reading it once is enough.
function useCurrentPath() {
  const [path, setPath] = useState("");
  useEffect(() => { setPath(window.location.pathname); }, []);
  return path;
}

function NavIcon({ name }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    health: <><path d="M12 20S4 15.4 4 9.2A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 8 2.2C20 15.4 12 20 12 20Z" /><path d="M8.5 12h2l1-2.5 1.5 5 1-2.5h1.5" /></>,
    medications: <><path d="m8.5 4.5 11 11a3.5 3.5 0 0 1-5 5l-11-11a3.5 3.5 0 0 1 5-5Z" /><path d="m6 7 5 5M14 15l3 3" /></>,
    wellbeing: <><path d="M6 4v10M4 4v5a2 2 0 0 0 4 0V4M6 14v6" /><path d="M16 4v16M16 4c2.2 0 4 1.8 4 4v2h-4" /></>,
    care: <><circle cx="10.5" cy="10" r="3.5" /><path d="M4 20c.7-3.1 2.8-4.5 6.5-4.5S16.3 16.9 17 20M17 4v6M14 7h6" /></>,
  };
  return <svg className="app-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

function NavLinks({ links, path, className, simplified = false, cards = false }) {
  return (
    <ul className={className}>
      {links.map(({ href, label, shortLabel, icon }) => (
        <li key={href}>
          <a
            href={href}
            className={cards ? "app-nav__card" : undefined}
            aria-current={path === href ? "page" : undefined}
            aria-label={simplified ? label : undefined}
          >
            {cards && <NavIcon name={icon} />}
            <span>{simplified ? shortLabel : label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
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
//   Desktop: logo and account controls, then a card-based section navigation row.
//            There is room on the right for more controls later, such as a notifications bell.
//   Phones (under 40rem / 640px): logo and a "Menu" button that opens a full-width panel with everything.
// The current page is marked with aria-current="page" (and highlighted) wherever its link appears.
export default function AppHeader() {
  const { selfProfile } = useActiveProfile() || {};
  const { preferences } = useAccessibility();
  const signedIn = useSignedIn();
  const path = useCurrentPath();
  const account = useDisclosure();
  const mobile = useDisclosure();
  const accountPage = ACCOUNT_LINKS.some((link) => link.href === path);

  return (
    <header className="site-header app-header">
      <div className="container container--wide app-header__bar">
        <Logo />
        {!signedIn && <nav aria-label="Public"><a href="/providers">{providerText("title")}</a></nav>}

        {signedIn && (
          <div className="app-header__end app-header__desktop">
            {/* Future controls (for example a notifications bell) go here, before the account menu. */}
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
        )}

        {signedIn && (
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
        )}
      </div>

      {signedIn && (
        <div className="app-header__navigation app-header__desktop">
          <div className="container container--wide">
            <nav aria-label="Main">
              <NavLinks links={MAIN_LINKS} path={path} className="app-nav__list" simplified={preferences.simplifiedMode} cards />
            </nav>
          </div>
        </div>
      )}

      {signedIn && mobile.open && (
        <div id="mobile-menu" ref={mobile.panelRef} className="mobile-menu">
          <div className="container">
            <nav aria-label="Main">
              <NavLinks links={MAIN_LINKS} path={path} className="mobile-menu__list mobile-menu__cards" simplified={preferences.simplifiedMode} cards />
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
