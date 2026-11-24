// Automated tests for the colour tokens in styles/tokens.css: every token the components use exists,
// and text on the primary colour stays readable (WCAG AA, 4.5:1) in both the normal and high-contrast themes.
import fs from "fs";
import path from "path";

const stylesDir = path.join(__dirname, "..", "styles");
const tokens = fs.readFileSync(path.join(stylesDir, "tokens.css"), "utf8");

// The custom properties set inside one rule block, e.g. ':root' or 'html[data-high-contrast="true"]'.
function block(selector) {
  const start = tokens.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No ${selector} block in tokens.css`);
  const body = tokens.slice(start, tokens.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe("Design tokens", () => {
  const root = block(":root");
  const highContrast = { ...root, ...block('html[data-high-contrast="true"]') };

  test("text on the primary colour meets WCAG AA in the normal and high-contrast themes", () => {
    expect(root["--color-on-primary"]).toBe("#ffffff");
    expect(contrast(root["--color-on-primary"], root["--color-primary"])).toBeGreaterThanOrEqual(4.5);
    expect(block('html[data-high-contrast="true"]')["--color-on-primary"]).toBe("#ffffff");
    expect(contrast(highContrast["--color-on-primary"], highContrast["--color-primary"])).toBeGreaterThanOrEqual(4.5);
  });

  // Every text pair in the tokens.css comments (4.5:1), and control boundaries and graphics (3:1). The PR and
  // docs/design-system.md list the same numbers.
  test.each([
    ["--color-text", "--color-bg", 4.5], ["--color-text", "--color-sunken", 4.5],
    ["--color-text-muted", "--color-bg", 4.5], ["--color-text-muted", "--color-surface", 4.5], ["--color-text-muted", "--color-sunken", 4.5],
    ["--color-placeholder", "--color-surface", 4.5],
    ["--color-primary", "--color-bg", 4.5], ["--color-primary-strong", "--color-primary-soft", 4.5],
    ["--color-accent", "--color-bg", 4.5], ["--color-accent-strong", "--color-accent-soft", 4.5],
    ["--color-danger", "--color-bg", 4.5], ["--color-on-primary", "--color-danger", 4.5], ["--color-danger-strong", "--color-danger-soft", 4.5],
    ["--color-success", "--color-bg", 4.5], ["--color-success-strong", "--color-success-soft", 4.5],
    ["--color-warning-strong", "--color-warning-soft", 4.5],
    ["--color-urgent", "--color-bg", 4.5], ["--color-urgent-strong", "--color-urgent-soft", 4.5],
    ["--color-routine", "--color-bg", 4.5], ["--color-routine-strong", "--color-routine-soft", 4.5],
    // Wellbeing is neutral now (the lilac is retired): spruce text and actions on stone, the pulse-green breathing dot.
    ["--color-primary-strong", "--color-sunken", 4.5], ["--color-primary", "--color-sunken", 4.5], ["--color-pulse", "--color-surface", 3],
    ["--color-border-strong", "--color-bg", 3], ["--color-border-strong", "--color-surface", 3], ["--color-border-strong", "--color-sunken", 3],
    ["--color-warning", "--color-bg", 3], ["--color-warning", "--color-warning-soft", 3],
    ["--color-pulse", "--color-bg", 3], ["--color-pulse-on-dark", "--color-primary-strong", 3],
  ])("%s on %s is at least %s:1", (fg, bg, min) => {
    expect(contrast(root[fg], root[bg])).toBeGreaterThanOrEqual(min);
  });

  test("the high-contrast routine colours stay readable", () => {
    expect(contrast(highContrast["--color-routine-strong"], highContrast["--color-routine-soft"])).toBeGreaterThanOrEqual(7);
    expect(contrast(highContrast["--color-routine"], highContrast["--color-bg"])).toBeGreaterThanOrEqual(7);
  });

  // An undefined token silently falls back to the inherited value: that is how today's date in the
  // appointments calendar ended up as dark text on teal.
  test("every --color-* token used in the stylesheets is defined", () => {
    const used = new Set();
    for (const file of fs.readdirSync(stylesDir).filter((name) => name.endsWith(".css"))) {
      const css = fs.readFileSync(path.join(stylesDir, file), "utf8");
      for (const [, name] of css.matchAll(/var\((--color-[\w-]+)\)/g)) used.add(name);
    }
    expect([...used].filter((name) => !(name in root))).toEqual([]);
  });
});
