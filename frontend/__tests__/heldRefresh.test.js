// "Held" visual refresh, Phase 1 (docs/design-system.md): the emergency result appears instantly, each urgency level
// has its own colours (never the brand green), the Held mark's states and the logo.
import fs from "fs";
import path from "path";
import { act, render, screen } from "@testing-library/react";
import UrgencyResult, { URGENCY_SCALE } from "../components/UrgencyResult";
import HeldMark, { HeldLoader, HELD_STATES } from "../components/ui/HeldMark";
import Logo from "../components/Logo";
import { useAccessibility } from "../context/AccessibilityContext";

jest.mock("../context/AccessibilityContext", () => ({ useAccessibility: jest.fn() }));
jest.mock("next/link", () => ({ __esModule: true, default: ({ children, ...props }) => <a {...props}>{children}</a> }));
jest.mock("../components/ReadAloudButton", () => ({ __esModule: true, default: () => null }));

const css = fs.readFileSync(path.join(__dirname, "../styles/components.css"), "utf8");
const tokens = fs.readFileSync(path.join(__dirname, "../styles/tokens.css"), "utf8");

// The declarations of every CSS rule whose selector list mentions `selector` (outside @keyframes).
function rulesFor(selector) {
  const withoutKeyframes = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  return [...withoutKeyframes.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(",").some((one) => one.trim().split(/\s+/).pop().includes(selector)))
    .map(([, selectors, body]) => ({ selectors: selectors.trim(), body }));
}

const result = (level) => ({
  level,
  label: Object.fromEntries(URGENCY_SCALE)[level],
  timeframe: level === "emergency" ? "Now" : "Within a few days",
  action: level === "emergency" ? "Call 140 now." : "Rest and drink fluids.",
  reasons: [],
  disclaimer: "This is guidance, not a diagnosis.",
});

beforeEach(() => {
  useAccessibility.mockReturnValue({ preferences: { simplifiedMode: false } });
});

describe("emergency never waits", () => {
  test("an emergency result renders with no entrance animation, in the same render", () => {
    render(<UrgencyResult result={result("emergency")} />);
    const section = screen.getByRole("alert");
    expect(section).toHaveClass("urgency", "urgency--emergency");
    expect(section).not.toHaveClass("urgency--enter");
    expect(section.className).not.toMatch(/enter|animate|fade|delay/);
    expect(screen.getByRole("heading", { name: "Urgency: Emergency" })).toBeInTheDocument();
    expect(screen.getByText("Now")).toBeInTheDocument();
  });

  test("no stylesheet rule gives the result card, or an emergency, an animation, transition or delay", () => {
    for (const selector of [".urgency", ".urgency--emergency", ".urgency-scale__step--emergency"]) {
      const exact = rulesFor(selector).filter(({ selectors }) =>
        selectors.split(",").some((one) => one.trim().split(/\s+/).pop().split(/[:[]/)[0] === selector));
      for (const { body } of exact) expect(body).not.toMatch(/animation|transition|delay/);
    }
  });

  test.each(["urgent", "soon", "routine"])("a %s result gets the short entrance (at most 240ms, ease-out)", (level) => {
    render(<UrgencyResult result={result(level)} />);
    expect(document.getElementById("symptom-result")).toHaveClass("urgency--enter");
    const [rule] = rulesFor(".urgency--enter").filter(({ selectors }) => selectors === ".urgency--enter");
    expect(rule.body).toMatch(/animation: urgency-enter var\(--duration-enter\) ease-out/);
    const duration = Number(tokens.match(/--duration-enter:\s*(\d+)ms/)[1]);
    expect(duration).toBeLessThanOrEqual(240);
  });

  test("an emergency arriving after a calmer preliminary result drops the entrance class", () => {
    const { rerender } = render(<UrgencyResult result={result("soon")} preliminary />);
    expect(document.getElementById("symptom-result")).toHaveClass("urgency--enter");
    rerender(<UrgencyResult result={result("emergency")} />);
    expect(document.getElementById("symptom-result")).not.toHaveClass("urgency--enter");
  });
});

describe("urgency colours", () => {
  test("every level has its own tokens and routine no longer uses the brand green", () => {
    for (const [selector, prefix] of [["urgency--routine", "routine"], ["urgency--soon", "warning"],
      ["urgency--urgent", "urgent"], ["urgency--emergency", "danger"]]) {
      const [rule] = rulesFor(`.${selector}`).filter(({ selectors }) => selectors === `.${selector}`);
      expect(rule.body).toContain(`var(--color-${prefix}-soft)`);
      expect(rule.body).toContain(`var(--color-${prefix})`);
      expect(rule.body).toContain(`var(--color-${prefix}-strong)`);
      expect(rule.body).not.toMatch(/--color-primary/);
    }
    const steps = rulesFor(".urgency-scale__step").map(({ body }) => body).join("\n");
    expect(steps).not.toMatch(/--step-[a-z]+:\s*var\(--color-primary/);
  });

  test("every level still shows its label and timeframe in writing", () => {
    for (const [level, label] of URGENCY_SCALE) {
      const { unmount } = render(<UrgencyResult result={result(level)} />);
      expect(screen.getByRole("heading", { name: `Urgency: ${label}` })).toBeInTheDocument();
      expect(screen.getByText(result(level).timeframe)).toBeInTheDocument();
      unmount();
    }
  });
});

describe("Held mark", () => {
  test.each(HELD_STATES)("the %s state is decorative and named by its class", (state) => {
    const { container } = render(<HeldMark state={state} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("held", `held--${state}`);
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelectorAll(".held__arc")).toHaveLength(2);
    expect(svg.querySelector(".held__ring") !== null).toBe(state === "done");
  });

  test("the loader pairs the thinking mark with a status text", () => {
    render(<HeldLoader label="Checking your symptoms" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/^Checking your symptoms$/);
    expect(status.querySelector("svg.held--thinking")).not.toBeNull();
  });

  test("reduced motion stills the logo and every Held state", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce) {\n  .logo__dot"));
    expect(reduced).toMatch(/\.logo__dot, \.logo--drop \.logo__dot, \.held, \.held \* \{ animation: none !important; transition: none !important; \}/);
  });

  test("only transform and opacity animate (the done ring's stroke-dashoffset is the one exception)", () => {
    const frames = [...css.matchAll(/@keyframes (held-[\w-]+|urgency-enter) \{([\s\S]*?)\n?\}\n/g)];
    expect(frames.length).toBeGreaterThan(0);
    for (const [, name, body] of frames) {
      const properties = [...body.matchAll(/([a-z-]+):/g)].map(([, property]) => property)
        .filter((property) => property !== "animation-timing-function");
      const allowed = name === "held-close" ? ["stroke-dashoffset"] : ["transform", "opacity"];
      expect(properties.every((property) => allowed.includes(property))).toBe(true);
    }
  });
});

describe("Held logo", () => {
  test("is a link named Nabad with a hidden mark and the lowercase wordmark", () => {
    render(<Logo href="/dashboard" />);
    const link = screen.getByRole("link", { name: "Nabad" });
    expect(link).toHaveAttribute("href", "/dashboard");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(link.querySelector("svg path")).toHaveAttribute("d", "M24 74 A56 56 0 0 0 136 74");
    expect(link.querySelector("svg circle")).toHaveAttribute("r", "19");
    expect(link).toHaveTextContent("nabad");
    expect(link).toHaveClass("logo--drop"); // first Logo of the app: the dot drops in
  });

  test("pauses the beat while the tab is hidden", () => {
    render(<Logo />);
    const link = screen.getByRole("link", { name: "Nabad" });
    expect(link).not.toHaveClass("logo--drop"); // later pages: no second drop
    expect(link).not.toHaveClass("logo--paused");
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(link).toHaveClass("logo--paused");
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(link).not.toHaveClass("logo--paused");
  });
});
