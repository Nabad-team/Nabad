// The line icons used in the navigation (header dropdowns, phone menu cards and the bottom tab bar).
export default function NavIcon({ name }) {
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
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    // Wellbeing: the breathing circle, inside and out.
    calm: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /></>,
    care: <><circle cx="10.5" cy="10" r="3.5" /><path d="M4 20c.7-3.1 2.8-4.5 6.5-4.5S16.3 16.9 17 20M17 4v6M14 7h6" /></>,
  };
  return <svg className="app-nav__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
