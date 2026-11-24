// Held refresh, phase 3: "say each thing once". The zero (Inter digits), the result's red flags, the shared
// timeline, the breathing dot and the retired lilac. The dashboard's button count and its one Held mark are in
// dashboard.test.js; the provider card's one primary action is in providers.test.js.
import fs from "fs";
import path from "path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import UrgencyResult from "../components/UrgencyResult";
import Timeline from "../components/ui/Timeline";
import BreathingDot from "../components/ui/BreathingDot";
import { HELD_STATES } from "../components/ui/HeldMark";
import { useAccessibility } from "../context/AccessibilityContext";

jest.mock("../context/AccessibilityContext", () => ({ useAccessibility: jest.fn() }));

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
const tokens = read("styles/tokens.css");
const base = read("styles/base.css");
const components = read("styles/components.css");

beforeEach(() => {
  useAccessibility.mockReturnValue({ preferences: { simplifiedMode: false } });
});

describe("the zero: every digit comes from Inter (a plain zero), every letter from Atkinson", () => {
  const faces = [...base.matchAll(/@font-face \{([^}]*)\}/g)].map(([, body]) => body).filter((body) => body.includes('"Nabad Digits"'));

  test("Nabad Digits is first in the font stack, so every number switches without markup changes", () => {
    expect(tokens).toMatch(/--font-sans: "Nabad Digits", var\(--font-atkinson\)/);
    expect(base).toMatch(/body \{[^}]*font-family: var\(--font-sans\)/);
  });

  test("its faces cover the digits 0-9 only, self-hosted, one per Atkinson weight step", () => {
    expect(faces.length).toBe(3);
    for (const face of faces) {
      expect(face).toMatch(/unicode-range: U\+0030-0039;/);
      const file = face.match(/url\("\/fonts\/([\w-]+\.woff2)"\)/)[1];
      expect(fs.existsSync(path.join(root, "public", "fonts", file))).toBe(true);
    }
    expect(faces.map((face) => face.match(/font-weight: ([\d ]+);/)[1])).toEqual(["100 549", "550 749", "750 1000"]);
    expect(fs.existsSync(path.join(root, "public", "fonts", "Inter-LICENSE.txt"))).toBe(true);
  });

  test("no slashed zero anywhere: no slashed-zero feature, no Atkinson Mono", () => {
    for (const file of ["styles/tokens.css", "styles/base.css", "styles/components.css", "pages/_app.js"]) {
      expect(read(file)).not.toMatch(/slashed-zero|"zero"|Atkinson_Hyperlegible_Mono|font-mono|atkinson-mono/);
    }
  });

  test("numbers people act on use tabular figures", () => {
    expect(components).toMatch(/\.num \{\n {2}font-variant-numeric: tabular-nums;\n\}/);
  });
});

describe("the result's red flags are always visible", () => {
  const CALL_140 = "Call 140 straight away if you get chest pain, trouble breathing, a drooping face or slurred speech, a seizure, or bleeding that won't stop.";
  const result = (level, extra = {}) => ({
    level, label: level === "emergency" ? "Emergency" : "Urgent", timeframe: "Today", action: "Get seen today.",
    reasons: [], disclaimer: "This is guidance, not a diagnosis.",
    explanation: {
      summary: "We suggest getting seen today.",
      watchFor: level === "emergency" ? ["Don't wait to see if it gets better. Call 140 now."] : [CALL_140, "If you can't be seen today, go to an emergency department."],
    },
    selfCareGuidance: ["Rest."],
    ...extra,
  });

  test.each([false, true])("urgent (simplified mode %s): every line, in its own block right under the header, never in a disclosure", (simplified) => {
    useAccessibility.mockReturnValue({ preferences: { simplifiedMode: simplified } });
    render(<UrgencyResult result={result("urgent")} />);
    const watch = document.querySelector(".urgency__watch");
    expect(watch.closest("details")).toBeNull();
    expect(watch).toBeVisible();
    expect(within(watch).getByText("Get help sooner if things change:")).toBeVisible();
    expect(within(watch).getByText(CALL_140)).toBeVisible();
    expect(within(watch).getByText("If you can't be seen today, go to an emergency department.")).toBeVisible();
    // Right under the header, before the details card; and the only place listing the call-140 conditions.
    const header = document.querySelector(".urgency__indicator");
    expect(header.compareDocumentPosition(watch) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(watch.compareDocumentPosition(document.querySelector(".urgency__details")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByText(CALL_140)).toHaveLength(1);
  });

  test("an emergency: the don't-wait line is visible, nothing on the card is animated", () => {
    render(<UrgencyResult result={result("emergency")} />);
    const watch = document.querySelector(".urgency__watch");
    expect(watch.closest("details")).toBeNull();
    expect(within(watch).getByText(/Don't wait to see if it gets better/)).toBeVisible();
    expect(document.getElementById("symptom-result")).not.toHaveClass("urgency--enter");
  });

  test("only secondary detail is collapsed: Why open, the AI notes and self-care closed, content unchanged", () => {
    render(<UrgencyResult result={result("urgent", { ai: { used: true }, reasons: ["Trouble swallowing should be checked today."] })} />);
    const rows = [...document.querySelectorAll(".urgency__details > details")];
    expect(rows.map((row) => [row.querySelector("summary").textContent, row.open])).toEqual([
      ["Why we suggest this", true], ["What the AI check noted", false], ["Self-care guidance", false],
    ]);
    expect(within(rows[1]).getByText("Trouble swallowing should be checked today.")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Rest.")).toBeInTheDocument();
  });

  test("the end of the result: Find care is the one primary button, Read aloud and Print are quiet, then Check something else", () => {
    const again = jest.fn();
    window.speechSynthesis = { cancel: jest.fn(), speak: jest.fn() };
    window.SpeechSynthesisUtterance = function Utterance(text) { this.text = text; };
    render(<UrgencyResult result={result("urgent")} onCheckAgain={again} />);
    const actions = document.querySelector(".urgency__actions");
    expect(actions.querySelectorAll(".button--primary")).toHaveLength(1);
    expect(within(actions).getByRole("button", { name: "Read aloud" })).toHaveClass("quiet-button");
    expect(within(actions).getByRole("button", { name: "Print or save as PDF" })).toHaveClass("quiet-button");
    fireEvent.click(within(actions).getByRole("button", { name: "Check something else" }));
    expect(again).toHaveBeenCalledTimes(1);
    delete window.speechSynthesis; delete window.SpeechSynthesisUtterance;
  });
});

describe("one timeline style (Previous checks, the health story, Recent checks)", () => {
  const items = [
    { key: "a", kind: "Symptom check", date: "24 November 2026", words: "a sore throat since Monday", chip: { text: "See a doctor soon", level: "soon" }, href: "/symptoms#check-a" },
    { key: "b", kind: "Appointment", icon: "calendar", date: "25 November 2026, 10:30", words: "Cardiology · AUBMC", chip: { text: "Upcoming", tone: "info" }, href: "/appointments#appointment-b" },
    { key: "c", kind: "Symptom check", date: "1 November 2026", words: "a cough", chip: { text: "Urgent" }, expand: { label: "Conversation from 1 November 2026", content: <p>You: a cough</p> } },
  ];

  test("each row: the date, the person's words, a chip; the whole row is the link; no bullets, triangles or Open links", () => {
    render(<Timeline label="Checks" items={items} />);
    const list = screen.getByRole("list", { name: "Checks" });
    expect(list).toHaveClass("timeline");
    const [first, second] = within(list).getAllByRole("listitem");
    const link = within(first).getByRole("link");
    expect(link).toHaveAttribute("href", "/symptoms#check-a");
    expect(link).toHaveTextContent("Symptom check, 24 November 2026a sore throat since MondaySee a doctor soon");
    expect(within(first).getByText("See a doctor soon")).toHaveClass("level-chip", "level-chip--soon");
    expect(within(second).getByText("Upcoming")).toHaveClass("status-chip", "status-chip--info");
    expect(list.querySelector(".timeline__date .num")).toBeNull();
    expect(list).not.toHaveTextContent(/▶|•|Open /);
    expect(components).toMatch(/\.timeline \{ margin: 0; padding: 0; list-style: none; \}/);
  });

  test("a row without its own page opens with a named chevron button; a level-only label still gets its level colour", () => {
    render(<Timeline label="Checks" items={items} />);
    const toggle = screen.getByRole("button", { name: "Conversation from 1 November 2026" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("You: a cough")).not.toBeVisible();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("You: a cough")).toBeVisible();
    expect(screen.getByText("Urgent")).toHaveClass("level-chip--urgent");
  });
});

describe("breathing is the dot alone, and the lilac is retired", () => {
  test("the breathing dot: in 4, hold 4, out 6, transform only, still with reduced motion", () => {
    const { container } = render(<BreathingDot />);
    expect(container.querySelector("svg.breathing-dot.breathing-dot--cycle")).toHaveAttribute("aria-hidden", "true");
    const frames = components.match(/@keyframes held-breathe \{([\s\S]*?)\n\}/)[1];
    expect(frames).toMatch(/28\.571% \{ transform: scale\(2\)/);
    expect(frames).toMatch(/57\.143% \{ transform: scale\(2\)/);
    expect([...frames.matchAll(/([a-z-]+):/g)].map(([, property]) => property).filter((p) => p !== "animation-timing-function").every((p) => p === "transform")).toBe(true);
    expect(components).toMatch(/\.breathing-dot--cycle \.breathing-dot__dot \{ animation: held-breathe 14s infinite; \}/);
    expect(components).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\n {2}\.breathing-dot, \.breathing-dot \* \{ animation: none !important; transition: none !important; \}/);
    expect(components).toMatch(/\.breathing-dot__dot \{ fill: var\(--color-pulse\);/);
  });

  test("the Held mark has no breathe state any more", () => {
    expect(HELD_STATES).toEqual(["resting", "thinking", "done", "urgent"]);
  });

  test("no --color-wellbeing token is defined or used anywhere", () => {
    const files = ["styles", "pages", "components", "lib"].flatMap(function walk(dir) {
      return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
        const relative = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(relative) : /\.(css|js)$/.test(entry.name) ? [relative] : [];
      });
    });
    expect(files.length).toBeGreaterThan(50);
    expect(files.filter((file) => /--color-wellbeing/.test(read(file)))).toEqual([]);
  });
});
