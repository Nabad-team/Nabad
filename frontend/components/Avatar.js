import { useState } from "react";

// Dark shades that all keep white text above WCAG AA (4.5:1); checked in __tests__/Avatar.test.js.
export const AVATAR_COLORS = [
  "#0f766e", // teal
  "#1d4ed8", // blue
  "#7e22ce", // purple
  "#b91c1c", // red
  "#c2410c", // orange
  "#15803d", // green
  "#be185d", // pink
  "#4338ca", // indigo
  "#334155", // slate
  "#a16207", // amber
];
// Used when there is no name, behind the person icon.
const NO_NAME_COLOR = "#4b5563";

// "Sami Haddad" -> "SH", "Sami" -> "S", "  " -> "". Array.from keeps non-Latin letters whole.
export function initialsFor(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";
  return (first + last).toLocaleUpperCase();
}

// The same name always gets the same color.
export function avatarColor(name) {
  const key = String(name || "").trim().toLowerCase();
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function PersonIcon({ size }) {
  return (
    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="white" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6z" />
    </svg>
  );
}

// A profile picture, or the person's initials in a colored circle when there is none
// (or it fails to load). Never requests anything from another site.
export default function Avatar({ name, src, size = 100, borderColor }) {
  // Remember which picture failed, so a new picture gets a fresh try.
  const [failedSrc, setFailedSrc] = useState(null);
  const label = name && name.trim() ? `Profile picture of ${name.trim()}` : "Profile picture";
  const circle = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    boxSizing: "border-box",
    ...(borderColor ? { border: `3px solid ${borderColor}` } : {}),
  };

  if (src && src !== failedSrc) {
    return <img src={src} alt={label} onError={() => setFailedSrc(src)} style={{ ...circle, objectFit: "cover" }} />;
  }

  const initials = initialsFor(name);
  return (
    <div
      role="img"
      aria-label={label}
      style={{
        ...circle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: initials ? avatarColor(name) : NO_NAME_COLOR,
        color: "white",
        fontWeight: "bold",
        fontSize: size * 0.4,
        userSelect: "none",
      }}
    >
      {initials ? <span aria-hidden="true">{initials}</span> : <PersonIcon size={size} />}
    </div>
  );
}
