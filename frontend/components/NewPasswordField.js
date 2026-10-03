import { useState } from "react";
import { getPasswordStrength, passwordChecklist, passwordIsTooLong, PASSWORD_HELP, PASSWORD_MESSAGES } from "../lib/passwordPolicy";

const visuallyHidden = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" };

// The password box for choosing a new password (signup and reset). No browser pattern/minLength checks: the page
// validates on submit with our own messages. Paste and password managers work; nothing blocks copy or paste.
// context ({ name, email }) adds the "doesn't include your name..." item; leave it out when the page doesn't know them.
export default function NewPasswordField({ id = "password", label = "Password", value, onChange, context, inputRef }) {
  const [visible, setVisible] = useState(false);
  const strength = getPasswordStrength(value, context);
  const tooLong = passwordIsTooLong(value);
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={id}>{label}</label>
      <p id={`${id}-help`} style={{ margin: "4px 0" }}>{PASSWORD_HELP}</p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0 8px" }}>
        <input id={id} ref={inputRef} type={visible ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" autoCapitalize="none" spellCheck={false} aria-describedby={`${id}-help ${id}-checklist`} aria-invalid={tooLong || undefined} style={{ flex: 1, padding: 8 }} />
        <button type="button" onClick={() => setVisible(!visible)} aria-controls={id} style={{ padding: "8px 10px" }}>{visible ? "Hide password" : "Show password"}</button>
      </div>
      {tooLong && <p role="alert" style={{ color: "#b42318", margin: "0 0 8px" }}>{PASSWORD_MESSAGES.tooLong}</p>}
      <ul id={`${id}-checklist`} aria-label="Password requirements" style={{ listStyle: "none", padding: 0, margin: "0 0 8px" }}>
        {passwordChecklist(value, context).map((item) => (
          <li key={item.id} data-met={item.met} style={{ color: !value ? "#475467" : item.met ? "#067647" : "#b42318" }}>
            <span aria-hidden="true">{value && item.met ? "✓" : "✗"} </span>
            <span style={visuallyHidden}>{value && item.met ? "Done: " : "Not yet: "}</span>
            {item.label}
          </li>
        ))}
      </ul>
      {strength && (
        <div>
          <div role="meter" aria-label="Password strength" aria-valuemin={1} aria-valuemax={5} aria-valuenow={strength.score} aria-valuetext={strength.label} style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4, 5].map((segment) => (
              <span key={segment} aria-hidden="true" style={{ height: 4, flex: 1, borderRadius: 2, backgroundColor: segment <= strength.score ? strength.color : "#d0d5dd" }} />
            ))}
          </div>
          <p role="status" aria-live="polite" style={{ margin: "6px 0 0", color: strength.color }}>
            Password strength: <strong>{strength.label}</strong>. {strength.detail}
          </p>
        </div>
      )}
    </div>
  );
}
