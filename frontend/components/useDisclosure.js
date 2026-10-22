import { useEffect, useRef, useState } from "react";

// A button that shows and hides a panel (the "disclosure" pattern, which suits navigation links better
// than an ARIA menu). Opening moves focus to the first link or control in the panel. Escape closes it and
// puts focus back on the button. Clicking outside, or tabbing out of the panel, closes it too.
export default function useDisclosure() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.querySelector("a, button:not(:disabled), select")?.focus();
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

  return { open, toggle: () => setOpen((value) => !value), close: () => setOpen(false), buttonRef, panelRef };
}
