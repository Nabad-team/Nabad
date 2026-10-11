// A form field: label, optional hint, the input itself, and an error message under it.
// The hint and error are linked to the input (aria-describedby), and an error marks it invalid,
// so screen readers read them with the field. as="select" or as="textarea" for other controls.
export default function Input({ id, label, hint, error, as: Control = "input", className = "", children, ...props }) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">{label}</label>
      {hint && <p id={hintId} className="field__hint">{hint}</p>}
      <Control
        id={id}
        className={`input ${className}`.trim()}
        {...props}
        aria-describedby={describedBy}
        aria-invalid={error ? true : props["aria-invalid"]}
      >
        {children}
      </Control>
      {error && <p id={errorId} className="field__error">{error}</p>}
    </div>
  );
}
