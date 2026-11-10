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
