import { useEffect, useId, useRef, useState } from "react";
import HeldIcon from "./HeldIcon";

// One list style for things that happened (docs/design-system.md#timeline): "Previous symptom checks" on /symptoms,
// the health story on /my-history and Recent checks on the dashboard. Each row: the date (normal font; the digits
// come from the digits font like everywhere), the person's own words on one line (truncated, the full text stays in
// the accessible name), and a chip: a symptom check's level in that level's soft colours, otherwise a small status
// such as "Upcoming". The whole row is the link. No bullets, triangles or "Open..." links.
//
// A row without a page of its own can expand instead (a saved conversation): a chevron button with an accessible
// name opens it under the row.
//
//   items: [{ key, id?, kind, icon, date, words, chip: { text, level?, tone? }, href?, expand?: { label, content, open? } }]
//     kind:  "Symptom check", "Appointment"... said to screen readers before the date, with the icon for the eye.
//     level: "routine" | "soon" | "urgent" | "emergency" colours the chip; tone "attention" | "info" | "neutral" otherwise.

// The level from the label the triage engine writes (backend/src/triage/urgency.js), for records that only keep the
// label (the health story).
export const LEVEL_BY_LABEL = { Emergency: "emergency", Urgent: "urgent", "See a doctor soon": "soon", "Routine / self-care": "routine" };

export function Chip({ chip }) {
  if (!chip?.text) return null;
  const level = chip.level || LEVEL_BY_LABEL[chip.text];
  return <span className={level ? `level-chip level-chip--${level}` : `status-chip status-chip--${chip.tone || "neutral"}`}>{chip.text}</span>;
}

function RowBody({ item }) {
  return (
    <>
      {item.icon && <span className="timeline__icon"><HeldIcon name={item.icon} size="1.25rem" /></span>}
      <span className="timeline__date">{item.kind && <span className="visually-hidden">{item.kind}, </span>}{item.date}</span>
      <span className="timeline__words">{item.words}</span>
      <Chip chip={item.chip} />
    </>
  );
}

// expand.open: open it from outside (a link to /symptoms#check-<id>), and bring it into view.
function ExpandRow({ item }) {
  const [open, setOpen] = useState(Boolean(item.expand.open));
  const panel = useId();
  const row = useRef(null);
  useEffect(() => {
    if (!item.expand.open) return;
    setOpen(true);
    row.current?.scrollIntoView?.({ block: "center" });
  }, [item.expand.open]);
  return (
    <li ref={row} className={`timeline__item${open ? " timeline__item--open" : ""}`} id={item.id}>
      <div className="timeline__row">
        <RowBody item={item} />
        <button type="button" className="timeline__toggle" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)}
          aria-label={item.expand.label}>
          <HeldIcon name="chevronDown" size="1.25rem" />
        </button>
      </div>
      <div id={panel} className="timeline__panel" hidden={!open}>{item.expand.content}</div>
    </li>
  );
}

export default function Timeline({ items, label, className = "" }) {
  return (
    <ol className={["timeline", className].filter(Boolean).join(" ")} aria-label={label}>
      {items.map((item) => item.expand ? <ExpandRow key={item.key} item={item} /> : (
        <li key={item.key} className="timeline__item" id={item.id}>
          <a href={item.href} className="timeline__row timeline__row--link">
            <RowBody item={item} />
            <HeldIcon name="chevronRight" size="1.125rem" className="timeline__chevron" />
          </a>
        </li>
      ))}
    </ol>
  );
}
