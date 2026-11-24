// "Held" visual refresh, Phase 2 (docs/design-system.md): the result's Held mark per level, the desktop sidebar,
// the retired mascot, numbers in the mono font, and the page title bar.
import fs from "fs";
import path from "path";
import { act, render, screen, within } from "@testing-library/react";
import UrgencyResult, { URGENCY_SCALE } from "../components/UrgencyResult";
import AppHeader from "../components/AppHeader";
import NabadAssistant from "../components/NabadAssistant";
import NumText from "../components/ui/NumText";
import PageTitle from "../components/ui/PageTitle";
import { DESKTOP_QUERY } from "../components/useDesktopLayout";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import { useAccessibility } from "../context/AccessibilityContext";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

jest.setTimeout(PAGE_FLOW_TIMEOUT);
jest.mock("../context/AccessibilityContext", () => ({ useAccessibility: jest.fn() }));
jest.mock("../components/ReadAloudButton", () => ({ __esModule: true, default: () => null }));
jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
jest.mock("../components/SessionTimeout", () => ({
  ...jest.requireActual("../components/SessionTimeout"),
  useSessionStatus: () => "signedIn",
  useSignedIn: () => true,
}));
jest.mock("../lib/session", () => ({ signOut: jest.fn() }));

const css = fs.readFileSync(path.join(__dirname, "../styles/components.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const result = (level) => ({
  level,
  label: Object.fromEntries(URGENCY_SCALE)[level],
  timeframe: level === "emergency" ? "Now" : "Within a few days",
  action: level === "emergency" ? "Call 140 now." : "Rest and drink fluids.",
  reasons: [],
  disclaimer: "This is guidance, not a diagnosis.",
});

// The declarations of every rule whose last selector part mentions `selector` (outside @keyframes).
function declarationsFor(selector) {
  const withoutKeyframes = css.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  return [...withoutKeyframes.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(",").some((one) => one.trim().split(/\s+/).pop().includes(selector)))
    .map(([, , body]) => body).join("\n");
}

beforeEach(() => {
  useAccessibility.mockReturnValue({ preferences: { simplifiedMode: false } });
});

describe("the result's Held mark", () => {
  test("an emergency uses the still urgent mark: no ring, nothing animated on the card", () => {
    const { container } = render(<UrgencyResult result={result("emergency")} />);
    const card = screen.getByRole("alert");
    const mark = card.querySelector("svg.held");
    expect(mark).toHaveClass("held--urgent", "urgency__mark");
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark.querySelector(".held__ring")).toBeNull();
    expect(card).not.toHaveClass("urgency--enter");
    // No class anywhere on the card that the stylesheet animates.
    const animated = new Set(["urgency--enter", "held--resting", "held--thinking", "held--done", "held--breathe", "held__ring", "logo--drop"]);
    const classes = [...container.querySelectorAll("[class]")].flatMap((element) => [...element.classList]);
    expect(classes.filter((name) => animated.has(name))).toEqual([]);
    // And the urgent state itself has no animation or transition in the stylesheet.
    expect(declarationsFor(".held--urgent")).not.toMatch(/animation|transition/);
  });

  test.each(["routine", "soon", "urgent"])("a %s result shows the done ring in its level colour", (level) => {
    render(<UrgencyResult result={result(level)} />);
    const card = document.getElementById("symptom-result");
    const mark = card.querySelector("svg.held");
    expect(mark).toHaveClass("held--done");
    expect(mark.querySelector("circle.held__ring")).not.toBeNull();
    expect(css).toMatch(/\.urgency__mark \.held__arc, \.urgency__mark \.held__ring \{ stroke: var\(--level\); \}/);
    expect(declarationsFor(`.urgency--${level}`)).toMatch(/--level: var\(--color-(routine|warning|urgent)\)/);
  });

  test("the scale bar keeps every step for screen readers and writes the level out", () => {
    render(<UrgencyResult result={result("soon")} />);
    const scale = screen.getByRole("list", { name: "Urgency scale, from lowest to highest" });
    expect(within(scale).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText((_, element) => element?.classList?.contains("urgency-scale__level") && element.textContent === "Level 2 of 4: See a doctor soon")).toBeInTheDocument();
  });
});

describe("desktop sidebar", () => {
  function mockWidth(desktop) {
    window.matchMedia = jest.fn((query) => ({
      matches: query === DESKTOP_QUERY ? desktop : false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
  }
  function renderHeader() {
    window.history.pushState({}, "", "/medications");
    return render(<ActiveProfileProvider><AppHeader /></ActiveProfileProvider>);
  }
  beforeEach(() => { localStorage.clear(); fakeProfileApi.resetFakeProfiles(); });
  afterEach(() => { delete window.matchMedia; });

  test("from 1024px: the sidebar holds the workspace, emergency 140 and the person; no tab bar", async () => {
    mockWidth(true);
    const { container } = renderHeader();
    await act(async () => {});
    const sidebar = container.querySelector(".app-sidebar");
    expect(sidebar).not.toBeNull();
    const workspace = within(sidebar).getByRole("navigation", { name: "Workspace" });
    expect(within(workspace).getByRole("link", { name: "Symptom check" })).toHaveAttribute("href", "/symptoms");
    expect(within(workspace).getByRole("button", { name: "My care, current section" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: "Emergency: call 140" })).toHaveAttribute("href", "tel:140");
    expect(await within(sidebar).findByRole("link", { name: /Demo User/ })).toHaveAttribute("href", "/profile");
    // One Workspace navigation only, and the phone tab bar is gone.
    expect(screen.getAllByRole("navigation", { name: "Workspace" })).toHaveLength(1);
    expect(screen.queryByRole("navigation", { name: "Quick links" })).not.toBeInTheDocument();
    // Search, notifications and the account menu stay in the header's top row.
    const header = container.querySelector("header");
    expect(within(header).getByRole("button", { name: "Account menu" })).toBeInTheDocument();
  });

  test("under 1024px: the header and the bottom tab bar, as before, and no sidebar", async () => {
    mockWidth(false);
    const { container } = renderHeader();
    await act(async () => {});
    expect(container.querySelector(".app-sidebar")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Quick links" })).toBeInTheDocument();
    expect(container.querySelector("header nav[aria-label='Workspace']")).not.toBeNull();
  });

  test("with enlarged text a 1280px window keeps the header and tab bar (64rem of the page's own text size)", async () => {
    mockWidth(true);
    const width = window.innerWidth;
    window.innerWidth = 1280;
    document.documentElement.style.fontSize = "32px"; // text at 200%: 64rem is 2048px
    try {
      const { container } = renderHeader();
      await act(async () => {});
      expect(container.querySelector(".app-sidebar")).toBeNull();
      expect(screen.getByRole("navigation", { name: "Quick links" })).toBeInTheDocument();
      // Back to normal text: the sidebar comes back without a reload.
      await act(async () => { document.documentElement.style.fontSize = ""; });
      expect(container.querySelector(".app-sidebar")).not.toBeNull();
    } finally {
      document.documentElement.style.fontSize = "";
      window.innerWidth = width;
    }
  });

  test("the sidebar layout starts at 64rem in the stylesheet, and the phone tab bar stays phone-only", () => {
    expect(DESKTOP_QUERY).toBe("(min-width: 64rem)");
    expect(css).toMatch(/\.page-shell:has\(> \.app-sidebar\) \{[^}]*display: grid;[^}]*grid-template-columns: 16rem minmax\(0, 1fr\);/);
    expect(css).toMatch(/\.page-shell:has\(> \.app-sidebar\) > \.app-sidebar \{ grid-column: 1; \}/);
    // The tab bar shows only under 40rem (the sidebar test above shows it isn't rendered at all from 64rem).
    expect(css).toMatch(/\.tab-bar \{\s*display: none;\s*\}\s*@media \(max-width: 39\.99rem\) \{\s*\.tab-bar \{[^}]*display: block;/);
  });
});

describe("the retired mascot", () => {
  test("NabadAssistant renders the resting Held mark with its accessible title", () => {
    render(<NabadAssistant size="4.5rem" title="Nabad assistant" />);
    const mark = screen.getByRole("img", { name: "Nabad assistant" });
    expect(mark).toHaveClass("held", "held--resting", "nabad-assistant");
    expect(mark).not.toHaveAttribute("aria-hidden");
    expect(mark).toHaveAttribute("width", "4.5rem");
  });

  test("without a title it is decorative, and tracing maps to thinking", () => {
    const { container } = render(<NabadAssistant crop="head" tracing />);
    const mark = container.querySelector("svg");
    expect(mark).toHaveClass("held--thinking");
    expect(mark).toHaveAttribute("aria-hidden", "true");
  });

  test("the old illustration and its loader are gone", () => {
    const source = fs.readFileSync(path.join(__dirname, "../components/NabadAssistant.js"), "utf8");
    expect(source).not.toMatch(/AssistantLoader|M6 88H24/);
    expect(css).not.toMatch(/nabad-assistant__(line|face)|assistant-trace/);
  });
});

describe("numbers in the mono font", () => {
  test("only the number and its unit are mono; the whole sentence is read once", () => {
    const { container } = render(<p><NumText>{"Daily reminders: 08:00, 20:00 (Asia/Beirut)"}</NumText></p>);
    expect([...container.querySelectorAll(".num")].map((element) => element.textContent)).toEqual(["08:00", "20:00"]);
    expect(screen.getByText("Daily reminders: 08:00, 20:00 (Asia/Beirut)")).toHaveClass("visually-hidden");
    expect(container.querySelector("[aria-hidden='true']")).toHaveTextContent("Daily reminders: 08:00, 20:00 (Asia/Beirut)");
  });

  test("a dose keeps its unit with it", () => {
    const { container } = render(<p><NumText>{"500 mg tablet · twice a day"}</NumText></p>);
    expect([...container.querySelectorAll(".num")].map((element) => element.textContent)).toEqual(["500 mg"]);
  });

  test("text without numbers stays plain", () => {
    const { container } = render(<p><NumText>{"Every morning"}</NumText></p>);
    expect(container.querySelector("p").innerHTML).toBe("Every morning");
  });
});

describe("page title bar", () => {
  test("a static spruce bar with the pulse dot replaces the heartbeat line", () => {
    const { container } = render(<PageTitle>My medications</PageTitle>);
    const bar = container.querySelector(".title-bar");
    expect(bar).toHaveAttribute("aria-hidden", "true");
    expect(bar.querySelector(".title-bar__dot")).not.toBeNull();
    expect(container.querySelector(".heartbeat-divider")).toBeNull();
    expect(declarationsFor(".title-bar")).toMatch(/width: 1\.75rem; height: 0\.1875rem/);
    expect(declarationsFor(".title-bar")).not.toMatch(/animation|transition/);
  });
});
