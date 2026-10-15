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
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home" },
  { href: "/my-health", label: "My health", shortLabel: "Health" },
  { href: "/medications", label: "Medications", shortLabel: "Medicines" },
  { href: "/water-and-sleep", label: "Water and sleep", shortLabel: "Water & sleep" },
  { href: "/providers", label: providerText("title"), shortLabel: providerText("title") },
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

function NavLinks({ links, path, className, simplified = false }) {
  return (
    <ul className={className}>
      {links.map(({ href, label, shortLabel }) => (
        <li key={href}>
          <a
            href={href}
            aria-current={path === href ? "page" : undefined}
            aria-label={simplified ? label : undefined}
          >
            {simplified ? shortLabel : label}
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
//   Desktop: logo, the main links, then (on the right) the profile switcher and the account menu.
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

        {signedIn && (
          <nav aria-label="Main" className="app-nav app-header__desktop">
            <NavLinks links={MAIN_LINKS} path={path} className="app-nav__list" simplified={preferences.simplifiedMode} />
          </nav>
        )}

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

      {signedIn && mobile.open && (
        <div id="mobile-menu" ref={mobile.panelRef} className="mobile-menu">
          <div className="container">
            <nav aria-label="Main">
              <NavLinks links={MAIN_LINKS} path={path} className="mobile-menu__list" simplified={preferences.simplifiedMode} />
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
