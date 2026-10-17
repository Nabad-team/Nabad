const TEAL = "#0f766e";

// The Nabad logo: a pulse icon followed by the name.
// The icon is drawn on a 32x32 grid (the viewBox), then scaled to `size` (2.25rem = 36px by default).
export default function Logo({ size = "2.25rem", href = "/" }) {
  return (
    <a
      href={href}
      style={{ display: "flex", alignItems: "center", gap: "0.625rem", textDecoration: "none", color: TEAL }}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        {/* Rounded square background: light teal fill, teal border */}
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#f0fdfa" stroke={TEAL} strokeWidth="2" />
        {/* Pulse line: flat, small bump, sharp spike up and down, flat again (like an ECG) */}
        <polyline
          points="5,17 11,17 13,14 15,17 17,7 20,25 22,17 27,17"
          fill="none"
          stroke={TEAL}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span style={{ fontSize: "1.5rem", fontWeight: "bold", lineHeight: 1 }}>Nabad</span>
    </a>
  );
}
