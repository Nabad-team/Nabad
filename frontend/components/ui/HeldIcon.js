// The Held icon set: one consistent line style for tiles, lists, cards and icon buttons. 24x24 grid, 2.2px strokes,
// round caps and joins, no fills (the same hand as the Held mark). Decorative: the link or button that holds an icon
// always has a visible label or an accessible name (aria-label) of its own.
const PATHS = {
  health: <><path d="M12 20s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.6 12 20 12 20Z" /></>,
  medicine: <><rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="m9.5 9.5 5 5" /></>,
  water: <><path d="M12 3.5s-6 6.6-6 10.8a6 6 0 0 0 12 0C18 10.1 12 3.5 12 3.5Z" /><path d="M9 15a3 3 0 0 0 3 3" /></>,
  sleep: <><path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
  vitals: <><path d="M3 12.5h4l2.2-5 4.2 10 2.3-5H21" /></>,
  document: <><path d="M7 3.5h6.5l4.5 4.5v10.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" /><path d="M13.5 3.5V8H18M9 13h6M9 16.5h4" /></>,
  emergencyCard: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M10 12h4M12 10v4" /></>,
  symptom: <><path d="M4.5 5.5h15v10h-9l-4 3.5v-3.5h-2Z" /><path d="M8 11h2.2l1-2 1.6 4 1-2H16" /></>,
  history: <><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4.5v3.8h3.8M12 8v4l2.8 1.8" /></>,
  phone: <><path d="M7.4 3.8 10 8.2 8 9.9a11 11 0 0 0 6.1 6.1l1.7-2 4.4 2.6-.7 2.6c-.3 1-1.2 1.6-2.2 1.5C10.4 20 4 13.6 3.3 6.7c-.1-1 .5-1.9 1.5-2.2Z" /></>,
  directions: <><path d="M12 2.8 21.2 12 12 21.2 2.8 12Z" /><path d="M9.5 14v-2.5a1.5 1.5 0 0 1 1.5-1.5h4M13 8l2 2-2 2" /></>,
  bookmark: <><path d="M7 4h10v16l-5-3.5L7 20Z" /></>,
  bookmarkFilled: <><path d="M7 4h10v16l-5-3.5L7 20Z" fill="currentColor" /></>,
  speaker: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  print: <><path d="M7 9V4h10v5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2" /><path d="M7 14h10v6H7Z" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>,
  location: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>,
  map: <><path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2Z" /><path d="M9 4.5v13M15 6.5v13" /></>,
  chevronDown: <><path d="m6 9.5 6 6 6-6" /></>,
  chevronRight: <><path d="m9.5 6 6 6-6 6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="m15 9-1.8 4.2L9 15l1.8-4.2Z" /></>,
  family: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.6-3 2.6-4.5 5.5-4.5s4.9 1.5 5.5 4.5M16 6.5a2.5 2.5 0 0 1 0 5M17.5 14.7c1.6.5 2.6 1.9 3 4.3" /></>,
  bell: <><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  clipboard: <><rect x="5" y="4.5" width="14" height="16" rx="2.5" /><path d="M9 4.5V3.5h6v1M9 11h6M9 15h4" /></>,
  scan: <><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M7.5 12h9" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
};

export const HELD_ICONS = Object.keys(PATHS);

export default function HeldIcon({ name, size = "1.5rem", className = "" }) {
  return (
    <svg className={["held-icon", className].filter(Boolean).join(" ")} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
