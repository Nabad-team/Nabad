import { useEffect, useState } from "react";
import Link from "next/link";

// The Nabad logo, "Held": a cupped arc holding a dot, then the lowercase name. The shape is also the Arabic letter
// noon (ن), the first letter of نبض. The mark is drawn on a 160x160 grid (the viewBox), scaled to `size`.
//
// Motion (docs/design-system.md#motion): on the first load of the app only, the dot drops in (500ms), then it
// beats slowly (2.4s). The beat pauses while the tab is hidden. With reduced motion the dot stays still.
// The keyframes live in styles/components.css (.logo).

// Module scope: true once a Logo has mounted, so moving between pages doesn't replay the drop.
let dropPlayed = false;

export const HELD_ARC = "M24 74 A56 56 0 0 0 136 74";

export default function Logo({ size = "2.25rem", href = "/" }) {
  // Same value on the server and in the first client render, so hydration matches.
  const [drop] = useState(() => !dropPlayed);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    dropPlayed = true;
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const className = ["logo", drop && "logo--drop", hidden && "logo--paused"].filter(Boolean).join(" ");
  return (
    <Link href={href} className={className} aria-label="Nabad">
      <svg className="logo__mark" width={size} height={size} viewBox="0 0 160 160" aria-hidden="true" focusable="false">
        <path d={HELD_ARC} fill="none" stroke="var(--color-primary)" strokeWidth="17" strokeLinecap="round" />
        <circle className="logo__dot" cx="80" cy="64" r="19" fill="var(--color-pulse)" />
      </svg>
      <span className="logo__word" aria-hidden="true">nabad</span>
    </Link>
  );
}
