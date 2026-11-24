import { useEffect, useState } from "react";

// The desktop layout starts at 64rem: the left sidebar replaces the header's navigation and the phone tab bar
// (docs/design-system.md#layouts). Below that everything stays as it was.
//
// 64rem of the page's own text size, not of the browser default: with the text-size setting (or a person's zoomed
// text) at 200%, a 1280px window is only 40 "rem" wide, so it keeps the phone and tablet layout instead of
// squeezing a 32rem-wide sidebar next to the content. Re-checked on resize and when the root font size changes.
// false on the server and in the first render; without matchMedia (jsdom) it stays false.
export const DESKTOP_QUERY = "(min-width: 64rem)";
export const DESKTOP_REM = 64;

function fitsDesktop() {
  if (!window.matchMedia?.(DESKTOP_QUERY)?.matches) return false;
  const rootPx = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  return window.innerWidth >= DESKTOP_REM * rootPx;
}

export default function useDesktopLayout() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const update = () => setDesktop(fitsDesktop());
    update();
    window.addEventListener("resize", update);
    // The text-size setting changes data-text-size on <html>; zoomed text can also set its style.
    const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(update);
    observer?.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "data-text-size", "class"] });
    return () => { window.removeEventListener("resize", update); observer?.disconnect(); };
  }, []);
  return desktop;
}
