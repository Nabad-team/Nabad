// A simple in-page pop-up: a dimmed overlay covering the page with a box in the middle.
// role="dialog" and aria-modal tell screen readers (and our tests) that this is a dialog.
// Styles: .dialog-overlay and .dialog in styles/components.css.
export default function Dialog({ title, children }) {
  return (
    <div className="dialog-overlay">
      <div role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="dialog">
        <h2 id="dialog-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
