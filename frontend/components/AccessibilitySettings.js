import { useAccessibility } from "../context/AccessibilityContext";

export default function AccessibilitySettings() {
  const { preferences, updatePreferences } = useAccessibility();

  return (
    <section className="section accessibility-settings" aria-labelledby="accessibility-heading">
      <h2 id="accessibility-heading">Accessibility</h2>
      <p>Change how Nabad looks and reads. Your choices are saved on this device.</p>

      <div className="form">
        <div className="field">
          <label htmlFor="text-size" className="field__label">Text size</label>
          <select
            id="text-size"
            className="input"
            value={preferences.textSize}
            onChange={(event) => updatePreferences({ textSize: event.target.value })}
          >
            <option value="default">Default</option>
            <option value="large">Large</option>
            <option value="extra-large">Extra large</option>
          </select>
        </div>

        <label className="check" htmlFor="high-contrast">
          <input
            id="high-contrast"
            type="checkbox"
            checked={preferences.highContrast}
            onChange={(event) => updatePreferences({ highContrast: event.target.checked })}
          />
          <span>High contrast</span>
        </label>

        <label className="check" htmlFor="simplified-mode">
          <input
            id="simplified-mode"
            type="checkbox"
            checked={preferences.simplifiedMode}
            onChange={(event) => updatePreferences({ simplifiedMode: event.target.checked })}
          />
          <span>Simplified mode (large icons and shorter text)</span>
        </label>
      </div>
    </section>
  );
}
