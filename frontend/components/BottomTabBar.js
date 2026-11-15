import { useEffect, useRef } from "react";
import Link from "next/link";
import NavIcon from "./NavIcon";

// The bottom tab bar on phones (under 40rem / 640px; hidden by CSS from 40rem and on paper).
// Three links (Symptom check, Dashboard, Find care) and a Menu button that opens the phone menu
// (the same disclosure as before: aria-expanded, Escape returns focus here, a click outside closes it).
// The current page's tab gets aria-current="page". On any other page Menu shows the current style and
// is named "Menu, current section", like the "My care" and "My records" dropdowns on desktop.
//   tabs: [{ href, label, icon }]   path: the current path   menu: the phone menu's useDisclosure()
export default function BottomTabBar({ tabs, path, menu }) {
  const menuCurrent = Boolean(path) && !tabs.some((tab) => tab.href === path);
  const barRef = useRef(null);

  // The page keeps exactly the bar's height free at the bottom (--tab-bar-space in components.css),
  // also when labels wrap with large text or the iPhone home-indicator space is added.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return undefined;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      const height = bar.offsetHeight;
      if (height) root.style.setProperty("--tab-bar-space", `${height}px`);
      else root.style.removeProperty("--tab-bar-space");
    });
    observer.observe(bar);
    return () => { observer.disconnect(); root.style.removeProperty("--tab-bar-space"); };
  }, []);

  return (
    <nav ref={barRef} aria-label="Quick links" className="tab-bar">
      <ul className="tab-bar__list">
        {tabs.map(({ href, label, icon }) => (
          <li key={href}>
            <Link href={href} className="tab-bar__item" aria-current={path === href ? "page" : undefined}>
              <NavIcon name={icon} />
              <span>{label}</span>
            </Link>
          </li>
        ))}
        <li>
          <button
            ref={menu.buttonRef}
            type="button"
            className={`tab-bar__item${menuCurrent ? " tab-bar__item--current" : ""}`}
            aria-expanded={menu.open}
            aria-controls="mobile-menu"
            aria-label={menuCurrent ? "Menu, current section" : undefined}
            onClick={menu.toggle}
          >
            <NavIcon name="menu" />
            <span>Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
