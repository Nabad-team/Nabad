import useDisclosure from "../useDisclosure";
import Button from "./Button";

// The "More" button for a page's secondary actions (see "One primary action, and More" in docs/design-system.md).
// It is a disclosure, not an ARIA menu: opening it focuses the first item, Escape closes it and returns focus
// to the button, and a click outside or tabbing out closes it.
//   id:    id of the panel (must be unique on the page)
//   items: [{ label, onClick } | { label, href }], with optional disabled. Falsy items are skipped,
//          so a page can write `condition && { ... }`.
export default function MoreMenu({ id, items, label = "More" }) {
  const more = useDisclosure();
  const shown = (items || []).filter(Boolean);
  if (!shown.length) return null;
  return (
    <div className="more-menu">
      <Button ref={more.buttonRef} variant="secondary" aria-expanded={more.open} aria-controls={id} onClick={more.toggle}>
        {label}<svg className="more-menu__chevron" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
      </Button>
      {more.open && <ul id={id} ref={more.panelRef} className="more-menu__panel">
        {shown.map((item, index) => <li key={index}>
          {item.href
            ? <a href={item.href}>{item.label}</a>
            : <button type="button" disabled={item.disabled} onClick={() => { more.close(); item.onClick(); }}>{item.label}</button>}
        </li>)}
      </ul>}
    </div>
  );
}
