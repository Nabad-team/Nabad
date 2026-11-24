// Held refresh, phase 3.2: urgency colour as an accent, not a flood. Only an emergency fills its card with its colour.
import fs from "fs";
import path from "path";
import { render, screen, within } from "@testing-library/react";
import UrgencyResult from "../components/UrgencyResult";
import Timeline from "../components/ui/Timeline";
import HomePage from "../pages/index";
import { useAccessibility } from "../context/AccessibilityContext";

jest.mock("../context/AccessibilityContext", () => ({ useAccessibility: jest.fn() }));
jest.mock("next/router", () => ({ useRouter: () => ({ query: {} }) }));

const css = fs.readFileSync(path.join(__dirname, "../styles/components.css"), "utf8").replace(/\r\n/g, "\n");
const LABELS = { routine: "Routine / self-care", soon: "See a doctor soon", urgent: "Urgent", emergency: "Emergency" };
const result = (level) => ({
  level, label: LABELS[level], timeframe: "Within 24 to 48 hours", action: "Book an appointment.", reasons: [],
  disclaimer: "This is guidance, not a diagnosis.",
  explanation: { summary: "Why.", watchFor: ["Call 140 straight away if you get chest pain."] },
});

beforeEach(() => useAccessibility.mockReturnValue({ preferences: { simplifiedMode: false } }));

describe("routine, soon and urgent: a white card with colour as an accent", () => {
  test.each(["routine", "soon", "urgent"])("%s: the level as a chip, how soon beside it, a small ring, the same heading", (level) => {
    render(<UrgencyResult result={result(level)} />);
    const card = document.getElementById("symptom-result");
    expect(card).toHaveClass("urgency--accent", `urgency--${level}`);
    const heading = screen.getByRole("heading", { level: 2, name: `Urgency: ${LABELS[level]}` });
    const chip = within(heading).getByText(LABELS[level]);
    expect(chip).toHaveClass("level-chip", `level-chip--${level}`);
    expect(heading.closest(".urgency__level-row")).toHaveTextContent("How soon: Within 24 to 48 hours");
    const marks = card.querySelectorAll(".urgency__indicator svg.held");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveAttribute("width", "2rem");
  });

  test("the styles: white card, a 4px top edge in the level colour, muted timeframe, action in ink", () => {
    expect(css).toMatch(/\.urgency--accent \.urgency__indicator \{\n {2}border: 1px solid var\(--color-border\);\n {2}border-top: 0\.25rem solid var\(--level\);\n {2}background: var\(--color-surface\);\n {2}color: var\(--color-text\);\n\}/);
    expect(css).toMatch(/\.urgency--accent \.urgency__timeframe \{ color: var\(--color-text-muted\); \}/);
    expect(css).toMatch(/\.urgency__action \{[^}]*color: var\(--color-text\);/);
  });
});

describe("an emergency keeps its full danger fill and the still mark", () => {
  test("no accent class, no chip, the large urgent mark", () => {
    render(<UrgencyResult result={result("emergency")} />);
    const card = screen.getByRole("alert");
    expect(card).not.toHaveClass("urgency--accent");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/^Urgency: Emergency$/);
    expect(card.querySelector(".urgency__indicator .level-chip")).toBeNull();
    const mark = card.querySelector("svg.held.held--urgent");
    expect(mark).toHaveAttribute("width", "3.25rem");
    expect(css).toMatch(/\.urgency__indicator \{[^}]*background: var\(--level-soft\);/);
  });
});

test("the scale bar: only the current segment in the level colour, the others neutral stone (no faded colours)", () => {
  const rule = css.match(/\.urgency-scale--bar \.urgency-scale__step \{([^}]*)\}/)[1];
  expect(rule).toMatch(/background: var\(--color-border\);/);
  expect(rule).not.toMatch(/opacity/);
  expect(css).toMatch(/\.urgency-scale--bar \.urgency-scale__step--current \{ background: var\(--step-color\); \}/);
});

test("level chips everywhere: soft background, dark text, a dot in the level colour, no border", () => {
  expect(css).toMatch(/\.level-chip::before \{ content: ""; flex: none; width: 0\.5rem; height: 0\.5rem; border-radius: 50%; background: var\(--chip-dot\); \}/);
  for (const [level, token] of [["routine", "routine"], ["soon", "warning"], ["urgent", "urgent"], ["emergency", "danger"]]) {
    expect(css).toContain(`.level-chip--${level} { --chip-soft: var(--color-${token}-soft); --chip-strong: var(--color-${token}-strong); --chip-dot: var(--color-${token}); }`);
  }
  expect(css.match(/\.level-chip \{([^}]*)\}/)[1]).not.toMatch(/border:/);
  // The same chip in the lists (timeline, history, recent checks).
  render(<Timeline label="Checks" items={[{ key: "a", date: "1 November 2026", words: "a cough", chip: { text: "See a doctor soon", level: "soon" }, href: "/symptoms#check-a" }]} />);
  expect(screen.getByText("See a doctor soon")).toHaveClass("level-chip", "level-chip--soon");
});

test("the landing sample: one white card, no nested card, the chip with how soon, the bar, the next step under a divider", () => {
  render(<HomePage />);
  const sample = screen.getByRole("figure", { name: /An example result/ });
  const card = sample.querySelector(".sample-result__card");
  expect(card.querySelectorAll(".urgency__indicator, .sample-result__card .sample-result__card")).toHaveLength(0);
  expect(within(card).getByText("See a doctor soon", { selector: ".level-chip" })).toHaveClass("level-chip--soon");
  expect(card).toHaveTextContent("Urgency: See a doctor soon");
  expect(card).toHaveTextContent("How soon: Within 24 to 48 hours");
  expect(card.querySelector(".urgency-scale--bar")).not.toBeNull();
  expect(card.lastElementChild).toHaveTextContent("Then: family medicine providers near you");
  expect(css).toMatch(/\.sample-result__next \{ padding-top: var\(--space-3\); border-top: 1px solid var\(--color-border\);/);
});

// The type system: Atkinson is loaded at 400, 700 and 800 only, and no text is smaller than 13px (phase 3.2).
describe("type: only the loaded weights, nothing under 13px", () => {
  const styles = ["tokens.css", "base.css", "components.css"].map((file) =>
    fs.readFileSync(path.join(__dirname, "../styles", file), "utf8").replace(/\r\n/g, "\n"));
  const all = styles.join("\n");
  // Declarations outside @font-face (its font-weight is a range of the faces it covers, not a weight to render).
  const rules = all.replace(/@font-face \{[^}]*\}/g, "");
  const tokens = Object.fromEntries([...styles[0].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));

  test("every font-weight resolves to 400, 700 or 800", () => {
    const weights = [...rules.matchAll(/font-weight:\s*([^;}]+)/g)].map(([, value]) => value.trim());
    expect(weights.length).toBeGreaterThan(50);
    const resolve = (value) => {
      const variable = value.match(/^var\((--[\w-]+)\)$/);
      return variable ? tokens[variable[1]] : value;
    };
    const bad = weights.map(resolve).filter((value) => !["400", "700", "800", "normal"].includes(value));
    expect(bad).toEqual([]);
    expect(Object.keys(tokens).filter((name) => name.startsWith("--weight-")).map((name) => tokens[name]).sort()).toEqual(["400", "700", "800"]);
    expect(fs.readFileSync(path.join(__dirname, "../components/Avatar.js"), "utf8")).not.toMatch(/fontWeight:\s*(500|600)/);
  });

  test("no font-size resolves below 13px", () => {
    const px = (value) => {
      value = value.trim();
      const variable = value.match(/^var\((--[\w-]+)(?:,\s*([^)]+))?\)$/);
      if (variable) return px(tokens[variable[1]] ?? variable[2] ?? "inherit");
      const clamp = value.match(/^clamp\(([^,]+),/);
      if (clamp) return px(clamp[1]);
      const max = value.match(/^max\((.+)\)$/);
      if (max) return Math.max(...max[1].split(/,(?![^(]*\))/).map((part) => px(part)).filter(Number.isFinite));
      let match;
      if ((match = value.match(/^([\d.]+)rem$/))) return Number(match[1]) * 16;
      if ((match = value.match(/^([\d.]+)px$/))) return Number(match[1]);
      if ((match = value.match(/^([\d.]+)pt$/))) return (Number(match[1]) * 4) / 3;
      // Relative sizes: only the root sizes (100% and up) and 1em or more; anything smaller could shrink below 13px.
      if ((match = value.match(/^([\d.]+)%$/))) return Number(match[1]) >= 100 ? 16 : NaN;
      if ((match = value.match(/^([\d.]+)em$/))) return Number(match[1]) >= 1 ? 16 : NaN;
      if (value === "inherit" || value === "100%") return 16;
      return NaN;
    };
    const sizes = [...rules.matchAll(/font-size:\s*([^;}]+)/g)].map(([, value]) => value.trim());
    expect(sizes.length).toBeGreaterThan(100);
    const bad = sizes.filter((value) => !(px(value) >= 13));
    expect(bad).toEqual([]);
    // A <small> never shrinks below the smallest size either (the helplines' "verified <date>" line).
    expect(styles[1]).toMatch(/small \{\n {2}font-size: max\(var\(--text-xs\), 0\.875em\);\n\}/);
    expect(tokens["--text-xs"]).toBe("0.8125rem");
  });
});
