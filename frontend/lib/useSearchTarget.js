import { useEffect } from "react";

// Search links contain only a record ID, never the query or health details.
export default function useSearchTarget(items, prefix) {
  useEffect(() => {
    const reveal = () => {
      const hash = window.location.hash.slice(1);
      if (!new RegExp(`^${prefix}-[a-f0-9]{24}$`).test(hash)) return;
      const target = document.getElementById(hash);
      if (!target) return;
      target.closest("details")?.setAttribute("open", "");
      target.scrollIntoView?.({ block: "center" });
      target.focus({ preventScroll: true });
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [items, prefix]);
}
