// Automated tests for the "Water and sleep" page.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WaterAndSleepPage from "../pages/water-and-sleep";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";
import * as fake from "../test-utils/fakeWellbeingApi";
import { todayString } from "../lib/dates";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";

// Full-page flows: slow under load for a good reason (see test-utils/timeouts.js).
jest.setTimeout(PAGE_FLOW_TIMEOUT);

jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
jest.mock("../lib/wellbeingApi", () => require("../test-utils/fakeWellbeingApi"));
// A fixed "today", so a run that crosses midnight can't have the page and the test disagree on the date.
jest.mock("../lib/dates", () => ({ ...jest.requireActual("../lib/dates"), todayString: () => "2026-10-12" }));
jest.mock("../components/SessionTimeout", () => ({
  ...jest.requireActual("../components/SessionTimeout"),
  useSessionStatus: () => "signedIn",
  useSignedIn: () => true,
}));

const TODAY = todayString();
const daysAgo = (n) => fake.shiftDate(TODAY, -n);
function renderPage() {
  return render(
    <ActiveProfileProvider>
      <WaterAndSleepPage />
    </ActiveProfileProvider>
  );
}
const water = () => screen.findByRole("region", { name: "Water today" });
const sleepSection = () => screen.findByRole("region", { name: "Last night's sleep" });
const count = async () => within(await water()).getByRole("status");

describe("Water and sleep page", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
    fake.resetFakeWellbeing();
  });

  test("starts empty: no glasses, no goal, no goal wording, an empty sleep form and an empty week", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Water and sleep" })).toBeInTheDocument();
    expect(await count()).toHaveTextContent("No glasses yet today");
    expect(screen.queryByText(/goal/i, { selector: "p, span" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set a daily goal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "− glass" })).toBeDisabled();
    expect(within(await sleepSection()).getByLabelText("Hours slept")).toHaveValue(null);
    expect(screen.getByText("Nothing logged this week yet.")).toBeInTheDocument();
    expect(screen.getByText("The week will show here as you log water and sleep.")).toBeInTheDocument();
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });

  test("logs water with + glass, the glass icon, and − glass", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "+ glass" }));
    expect(await count()).toHaveTextContent("1 glass today");
    await user.click(screen.getByRole("button", { name: "+ glass" }));
    expect(await count()).toHaveTextContent("2 glasses today");
    // The next empty glass is a big button too.
    await user.click(screen.getByRole("button", { name: "Add a glass" }));
    expect(await count()).toHaveTextContent("3 glasses today");
    await user.click(screen.getByRole("button", { name: "− glass" }));
    expect(await count()).toHaveTextContent("2 glasses today");

    expect(fake.calls.filter(([name]) => name === "addGlass")).toEqual([["addGlass", "self", TODAY], ["addGlass", "self", TODAY], ["addGlass", "self", TODAY]]);
    expect(fake.fakeData("self").water[TODAY]).toBe(2);
    // Without a goal there is never a "more to go" message.
    expect(screen.queryByText(/more to reach/)).not.toBeInTheDocument();
  });

  test("sets, changes and clears a daily goal; gentle wording only while a goal is set", async () => {
    const user = userEvent.setup({ delay: null });
    fake.seedWater("self", TODAY, 2);
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Set a daily goal" }));
    const goal = screen.getByLabelText("Daily goal (glasses)");
    expect(goal).toHaveAccessibleDescription(/If a doctor has asked you to limit fluids, follow their advice/);
    await user.type(goal, "0");
    await user.click(screen.getByRole("button", { name: "Save goal" }));
    expect(goal).toHaveAccessibleDescription(/Enter a whole number of glasses from 1 to 30/);
    expect(fake.calls.some(([name]) => name === "setWaterTarget")).toBe(false);

    await user.clear(goal);
    await user.type(goal, "8");
    await user.click(screen.getByRole("button", { name: "Save goal" }));
    expect(await count()).toHaveTextContent("2 of 8 glasses");
    expect(await count()).toHaveTextContent("6 more to reach your goal.");
    expect(screen.getByText("Daily goal: 8 glasses")).toBeInTheDocument();
    expect(fake.calls).toContainEqual(["setWaterTarget", "self", 8]);

    await user.click(screen.getByRole("button", { name: "Change goal" }));
    expect(screen.getByLabelText("Daily goal (glasses)")).toHaveValue(8);
    await user.clear(screen.getByLabelText("Daily goal (glasses)"));
    await user.type(screen.getByLabelText("Daily goal (glasses)"), "2");
    await user.click(screen.getByRole("button", { name: "Save goal" }));
    expect(await count()).toHaveTextContent("2 of 2 glasses");
    expect(await count()).toHaveTextContent("You've reached your goal for today.");

    await user.click(screen.getByRole("button", { name: "Remove goal" }));
    expect(await count()).toHaveTextContent("2 glasses today");
    expect(await count()).not.toHaveTextContent(/goal/);
    expect(fake.calls).toContainEqual(["clearWaterTarget", "self"]);
    expect(screen.getByRole("button", { name: "Set a daily goal" })).toBeInTheDocument();
  });

  test("logs, edits and removes last night's sleep", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    const section = await sleepSection();

    await user.click(within(section).getByRole("button", { name: "Save sleep" }));
    expect(within(section).getByLabelText("Hours slept")).toHaveAccessibleDescription(/Enter the hours slept, from 0 to 24/);
    expect(within(section).getByText("Choose how well the night went.")).toBeInTheDocument();

    await user.type(within(section).getByLabelText("Hours slept"), "7.5");
    const quality = within(section).getByRole("group", { name: "How well did you sleep?" });
    expect(within(quality).getAllByRole("radio").map((radio) => radio.labels[0].textContent)).toEqual(["Very poorly", "Poorly", "Okay", "Well", "Very well"]);
    await user.click(within(quality).getByLabelText("Well"));
    await user.type(within(section).getByLabelText("Note (optional)"), "Woke once");
    await user.click(within(section).getByRole("button", { name: "Save sleep" }));

    expect(await within(section).findByText("7.5 hours")).toBeInTheDocument();
    expect(within(section).getByText(/Slept well/)).toBeInTheDocument();
    expect(within(section).getByText("Woke once")).toBeInTheDocument();
    expect(fake.calls).toContainEqual(["saveSleep", "self", TODAY, { hours: 7.5, quality: 4, note: "Woke once" }]);

    await user.click(within(section).getByRole("button", { name: "Edit" }));
    expect(within(section).getByLabelText("Hours slept")).toHaveValue(7.5);
    await user.clear(within(section).getByLabelText("Hours slept"));
    await user.type(within(section).getByLabelText("Hours slept"), "6");
    await user.click(within(section).getByRole("button", { name: "Save sleep" }));
    expect(await within(section).findByText("6 hours")).toBeInTheDocument();

    await user.click(within(section).getByRole("button", { name: "Remove" }));
    expect(await within(section).findByRole("button", { name: "Save sleep" })).toBeInTheDocument();
    expect(within(section).getByLabelText("Hours slept")).toHaveValue(null);
    expect(fake.fakeData("self").sleep[TODAY]).toBeUndefined();
  });

  test("shows the week as charts with text summaries, a table, and one gentle observation", async () => {
    fake.seedTarget("self", 6);
    [[6, 4], [5, 6], [4, 8], [3, 0], [0, 3]].forEach(([ago, glasses]) => fake.seedWater("self", daysAgo(ago), glasses));
    [[5, 4], [4, 4.5], [3, 3], [1, 7.5]].forEach(([ago, hours]) => fake.seedSleep("self", daysAgo(ago), hours, 2));
    renderPage();

    const waterChart = await screen.findByRole("figure", { name: "Water" });
    expect(within(waterChart).getByText("Average water this week: 4.2 glasses a day, over 5 days logged.")).toBeInTheDocument();
    const sleepChart = screen.getByRole("figure", { name: "Sleep" });
    expect(within(sleepChart).getByText("Average sleep this week: 4.8 hours, over 4 nights logged.")).toBeInTheDocument();

    // The drawing is hidden from screen readers; the table has every day.
    const rows = within(within(sleepChart).getByRole("table")).getAllByRole("row").slice(1).map((row) => row.textContent);
    expect(rows).toHaveLength(7);
    expect(rows[6]).toMatch(/Not logged$/);
    expect(rows[5]).toMatch(/7\.5 hours$/);
    expect(within(sleepChart).getByText("Show the numbers")).toBeInTheDocument();

    // One observation only: three short nights (the water goal days would be the second, unused one).
    expect(screen.getByText("You've slept under 5 hours on 3 nights this week.")).toBeInTheDocument();
    expect(screen.queryByText(/water goal on/)).not.toBeInTheDocument();
  });

  test("makes no observation when nothing is clearly true", async () => {
    [[2, 4], [1, 8]].forEach(([ago, hours]) => fake.seedSleep("self", daysAgo(ago), hours));
    fake.seedWater("self", daysAgo(1), 1);
    renderPage();
    expect(await screen.findByRole("figure", { name: "Sleep" })).toBeInTheDocument();
    expect(screen.queryByText(/slept under/)).not.toBeInTheDocument();
    expect(screen.queryByText(/water goal on/)).not.toBeInTheDocument();
  });

  test("follows the header profile switcher", async () => {
    const user = userEvent.setup({ delay: null });
    const child = await fakeProfileApi.addLinkedProfile({ fullName: "Sami Haddad", dateOfBirth: "2018-04-02", relationship: "child" });
    fake.seedWater("self", TODAY, 5);
    fake.seedWater(child.id, TODAY, 2);
    fake.seedTarget(child.id, 4);
    fake.seedSleep(child.id, TODAY, 10, 5);
    renderPage();

    expect(await count()).toHaveTextContent("5 glasses today");
    await user.selectOptions(screen.getByLabelText("Active profile"), child.id);

    expect(await screen.findByRole("heading", { level: 1, name: "Water and sleep for Sami Haddad" })).toBeInTheDocument();
    expect(screen.getByText("Acting as: Sami Haddad (child)")).toBeInTheDocument();
    expect(await count()).toHaveTextContent("2 of 4 glasses");
    expect(within(await sleepSection()).getByText("10 hours")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ glass" }));
    expect(await count()).toHaveTextContent("3 of 4 glasses");
    expect(fake.calls).toContainEqual(["addGlass", child.id, TODAY]);
    expect(fake.fakeData("self").water[TODAY]).toBe(5);

    await user.selectOptions(screen.getByLabelText("Active profile"), "self");
    expect(await screen.findByRole("heading", { level: 1, name: "Water and sleep" })).toBeInTheDocument();
    expect(await count()).toHaveTextContent("5 glasses today");
    expect(within(await sleepSection()).getByLabelText("Hours slept")).toBeInTheDocument();
  });

  test("uses the family member's name in the sleep question and goal hint", async () => {
    const user = userEvent.setup({ delay: null });
    const child = await fakeProfileApi.addLinkedProfile({ fullName: "Sami Haddad", dateOfBirth: "2018-04-02", relationship: "child" });
    localStorage.setItem("nabad-active-profile-id", child.id);
    renderPage();
    expect(await screen.findByRole("group", { name: "How well did Sami Haddad sleep?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Set a daily goal" }));
    expect(screen.getByLabelText("Daily goal (glasses)")).toHaveAccessibleDescription(/Only if a goal suits Sami Haddad\. If a doctor has asked them to limit fluids/);
  });

  test("has the page title and a header link, and is only for signed-in users", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Water and sleep" })).toHaveAttribute("href", "/water-and-sleep");
    expect(WaterAndSleepPage.requireSignIn).toBe(true);
  });
});
