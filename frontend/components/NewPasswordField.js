import { useState } from "react";
import { getPasswordStrength, passwordChecklist, passwordIsTooLong, PASSWORD_HELP, PASSWORD_MESSAGES } from "../lib/passwordPolicy";
import Button from "./ui/Button";

// The password box for choosing a new password (signup and reset). No browser pattern/minLength checks: the page
// validates on submit with our own messages. Paste and password managers work; nothing blocks copy or paste.
// context ({ name, email }) adds the "doesn't include your name..." item; leave it out when the page doesn't know them.
export default function NewPasswordField({ id = "password", label = "Password", value, onChange, context, inputRef }) {
  const [visible, setVisible] = useState(false);
  const strength = getPasswordStrength(value, context);
  const tooLong = passwordIsTooLong(value);
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">{label}</label>
      <p id={`${id}-help`} className="field__hint">{PASSWORD_HELP}</p>
      <div className="password-row">
        <input id={id} ref={inputRef} className="input" type={visible ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" autoCapitalize="none" spellCheck={false} aria-describedby={`${id}-help ${id}-checklist`} aria-invalid={tooLong || undefined} />
        <Button variant="secondary" size="small" onClick={() => setVisible(!visible)} aria-controls={id}>{visible ? "Hide password" : "Show password"}</Button>
      </div>
      {tooLong && <p role="alert" className="field__error">{PASSWORD_MESSAGES.tooLong}</p>}
      <ul id={`${id}-checklist`} aria-label="Password requirements" className="checklist">
        {passwordChecklist(value, context).map((item) => (
          <li key={item.id} data-met={item.met} className={!value ? "" : item.met ? "checklist__item--met" : "checklist__item--unmet"}>
            {/* A neutral dot until the user starts typing, then a check or a cross. */}
            <span aria-hidden="true" className="checklist__mark">{!value ? "•" : item.met ? "✓" : "✗"}</span>
            <span className="visually-hidden">{value && item.met ? "Done: " : "Not yet: "}</span>
            {item.label}
          </li>
        ))}
      </ul>
      {strength && (
        <div>
          <div role="meter" aria-label="Password strength" aria-valuemin={1} aria-valuemax={5} aria-valuenow={strength.score} aria-valuetext={strength.label} className="strength-meter">
            {[1, 2, 3, 4, 5].map((segment) => (
              <span key={segment} aria-hidden="true" style={{ backgroundColor: segment <= strength.score ? strength.color : undefined }} />
            ))}
          </div>
          <p role="status" aria-live="polite" className="text-sm" style={{ margin: "var(--space-2) 0 0", color: strength.color }}>
            Password strength: <strong>{strength.label}</strong>. {strength.detail}
          </p>
        </div>
      )}
    </div>
  );
}
