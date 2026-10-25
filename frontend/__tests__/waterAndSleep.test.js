// Automated tests for the "Water and sleep" page.
import { render, screen, within, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WaterAndSleepPage from "../pages/water-and-sleep";
import { ActiveProfileProvider } from "../context/ActiveProfileContext";
import * as fakeProfileApi from "../test-utils/fakeProfileApi";
import * as fake from "../test-utils/fakeWellbeingApi";
import { todayString } from "../lib/dates";
import { PAGE_FLOW_TIMEOUT } from "../test-utils/timeouts";
import { addDrink } from "../lib/wellbeingApi";

// Full-page flows: slow under load for a good reason (see test-utils/timeouts.js).
jest.setTimeout(PAGE_FLOW_TIMEOUT);

jest.mock("../lib/profileApi", () => require("../test-utils/fakeProfileApi"));
jest.mock("../lib/wellbeingApi", () => ({ ...require("../test-utils/fakeWellbeingApi"), addDrink: jest.fn() }));
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
const log = () => screen.queryByRole("list", { name: "Today's log" });
const logItems = () => within(log()).getAllByRole("listitem").map((item) => item.textContent);

describe("Water and sleep page", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeProfileApi.resetFakeProfiles();
    fake.resetFakeWellbeing();
    addDrink.mockReset().mockImplementation(fake.addDrink);
  });

  test("starts empty: nothing logged, no goal, no goal wording, an empty sleep form and an empty week", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Water and sleep" })).toBeInTheDocument();
    expect(await count()).toHaveTextContent("Nothing logged yet today");
    expect(screen.queryByText(/goal|limit/i, { selector: "p, span" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set a daily goal" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo last drink" })).not.toBeInTheDocument();
    expect(log()).not.toBeInTheDocument();
    expect(within(await sleepSection()).getByLabelText("Hours slept")).toHaveValue(null);
    expect(screen.getByText("Nothing logged this week yet.")).toBeInTheDocument();
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });

  test("updates a glass immediately, prevents duplicates and saves without reloading today or history", async () => {
    let finish;
    addDrink.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    fake.seedGoal("self", { type: "atLeast", ml: 2000 });
    renderPage();
    const glass = await screen.findByRole("button", { name: "Glass (250 ml)" });
    fireEvent.click(glass);
    expect(await count()).toHaveTextContent("0.25 L of 2.0 L");
    expect(await count()).toHaveTextContent("1.75 L more to reach the goal.");
    expect(glass).toBeDisabled();
    fireEvent.click(glass);
    expect(addDrink).toHaveBeenCalledTimes(1);
    await act(async () => { finish(await fake.addDrink("self", TODAY, 250)); });
    expect(glass).toBeEnabled();
    expect(fake.calls.filter(([name]) => name === "getToday")).toHaveLength(1);
    expect(fake.calls.filter(([name]) => name === "getHistory")).toHaveLength(1);
    expect(screen.getByText(/Average fluids this week: 0.25 L a day/)).toBeInTheDocument();
  });

  test("restores the water total and chart if an immediate update fails to save", async () => {
    let fail;
    addDrink.mockImplementation(() => new Promise((resolve, reject) => { fail = reject; }));
    renderPage();
    const glass = await screen.findByRole("button", { name: "Glass (250 ml)" });
    fireEvent.click(glass);
    expect(await count()).toHaveTextContent("0.25 L today");
    await act(async () => { fail(new Error("Could not save drink")); });
    expect(await count()).toHaveTextContent("Nothing logged yet today");
    expect(screen.getByText("Nothing logged this week yet.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save drink");
    expect(glass).toBeEnabled();
  });

  test("a slow drink response cannot change another profile's tracker", async () => {
    let finish;
    addDrink.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const child = await fakeProfileApi.addLinkedProfile({ fullName: "Sami Haddad", dateOfBirth: "2018-04-02", relationship: "child" });
    fake.seedWater(child.id, TODAY, 500);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Glass (250 ml)" }));
    fireEvent.change(screen.getByLabelText("Active profile"), { target: { value: child.id } });
    await waitFor(async () => expect(await count()).toHaveTextContent("0.5 L today"));
    await act(async () => { finish(await fake.addDrink("self", TODAY, 250)); });
    expect(await count()).toHaveTextContent("0.5 L today");
  });

  test("logs a glass, a bottle and a custom amount in millilitres, shows litres and a timed log, and undoes the last", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Glass (250 ml)" }));
    expect(await count()).toHaveTextContent("0.25 L today");
    await user.click(screen.getByRole("button", { name: "Bottle (500 ml)" }));
    expect(await count()).toHaveTextContent("0.75 L today");

    await user.click(screen.getByRole("button", { name: "Custom amount" }));
    expect(screen.getByRole("button", { name: "Custom amount" })).toHaveAttribute("aria-expanded", "true");
    const amount = screen.getByLabelText("Amount (ml)");
    await user.type(amount, "2500");
    await user.click(screen.getByRole("button", { name: "Add drink" }));
    expect(amount).toHaveAccessibleDescription(/Enter an amount from 10 to 2000 ml/);
    await user.clear(amount);
    await user.type(amount, "330");
    await user.click(screen.getByRole("button", { name: "Add drink" }));
    expect(await count()).toHaveTextContent("1.08 L today");
    expect(screen.queryByLabelText("Amount (ml)")).not.toBeInTheDocument();

    expect(fake.calls.filter(([name]) => name === "addDrink")).toEqual([
      ["addDrink", "self", TODAY, 250], ["addDrink", "self", TODAY, 500], ["addDrink", "self", TODAY, 330],
    ]);
    // Each drink with the time it was logged.
    expect(logItems()).toHaveLength(3);
    logItems().forEach((item, i) => expect(item).toMatch(new RegExp(`^\\d{2}:\\d{2} ${[250, 500, 330][i]} ml$`)));

    const undo = screen.getByRole("button", { name: "Undo last drink" });
    expect(undo).toHaveAccessibleDescription(/^330 ml at \d{2}:\d{2}$/);
    await user.click(undo);
    expect(await count()).toHaveTextContent("0.75 L today");
    expect(logItems()).toHaveLength(2);
    expect(fake.calls).toContainEqual(["undoLastDrink", "self", TODAY]);
    expect(fake.totalOn("self", TODAY)).toBe(750);
    // Without a goal there is never a "more to go" message.
    expect(screen.queryByText(/more to reach/)).not.toBeInTheDocument();
  });

  test("a \"Drink at least\" goal in litres: progress and gentle wording, then changed and removed", async () => {
    const user = userEvent.setup({ delay: null });
    fake.seedWater("self", TODAY, [500, 250]);
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Set a daily goal" }));
    const goal = screen.getByLabelText("Amount a day");
    expect(goal).toHaveAccessibleDescription(/If a doctor has given you a fluid limit, choose "Stay under"/);
    expect(screen.getByLabelText("Unit")).toHaveValue("L");
    await user.type(goal, "2");
    await user.click(screen.getByRole("button", { name: "Save goal" }));
    expect(screen.getByText("Choose \"Drink at least\" or \"Stay under\".")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Drink at least"));
    await user.clear(goal); await user.type(goal, "20");
    await user.click(screen.getByRole("button", { name: "Save goal" }));
    expect(goal).toHaveAccessibleDescription(/Enter an amount from 100 ml to 10 litres/);
    expect(fake.calls.some(([name]) => name === "setWaterGoal")).toBe(false);

    await user.clear(goal); await user.type(goal, "2");
    await user.click(screen.getByRole("button", { name: "Save goal" }));
    expect(await count()).toHaveTextContent("0.75 L of 2.0 L");
    expect(await count()).toHaveTextContent("1.25 L more to reach the goal.");
    expect(screen.getByText("Daily goal: drink at least 2.0 L a day")).toBeInTheDocument();
    expect(fake.calls).toContainEqual(["setWaterGoal", "self", { type: "atLeast", ml: 2000 }]);

    // Changing it to millilitres.
    await user.click(screen.getByRole("button", { name: "Change goal" }));
    expect(screen.getByLabelText("Amount a day")).toHaveValue(2);
    expect(screen.getByLabelText("Drink at least")).toBeChecked();
    await user.selectOptions(screen.getByLabelText("Unit"), "ml");
    await user.clear(screen.getByLabelText("Amount a day"));
    await user.type(screen.getByLabelText("Amount a day"), "750");
    await user.click(screen.getByRole("button", { name: "Save goal" }));
    expect(await count()).toHaveTextContent("0.75 L of 0.75 L");
    expect(await count()).toHaveTextContent("Goal reached for today.");
    expect(fake.calls).toContainEqual(["setWaterGoal", "self", { type: "atLeast", ml: 750 }]);

    await user.click(screen.getByRole("button", { name: "Remove goal" }));
    expect(await count()).toHaveTextContent("0.75 L today");
    expect(await count()).not.toHaveTextContent(/goal/);
    expect(fake.calls).toContainEqual(["clearWaterGoal", "self"]);
  });

  test("a \"Stay under\" limit: progress toward it, a gentle warning near and over it, and never a nudge to drink", async () => {
    const user = userEvent.setup({ delay: null });
    fake.seedWater("self", TODAY, [500]);
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Set a daily goal" }));
    await user.click(screen.getByLabelText("Stay under (a fluid limit)"));
    await user.type(screen.getByLabelText("Amount a day"), "1.5");
    await user.click(screen.getByRole("button", { name: "Save goal" }));
    expect(fake.calls).toContainEqual(["setWaterGoal", "self", { type: "atMost", ml: 1500 }]);

    expect(await count()).toHaveTextContent("0.5 L of the 1.5 L limit");
    expect(screen.getByText("Daily limit: stay under 1.5 L a day")).toBeInTheDocument();
    const noNudge = () => expect(within(screen.getByRole("region", { name: "Water today" })).queryByText(/more|left|reach|keep|drink up/i, { selector: "p, span" })).not.toBeInTheDocument();
    noNudge();
    expect(screen.queryByText(/close to the daily limit/)).not.toBeInTheDocument();

    // 0.5 + 0.5 + 0.25 = 1.25 L: from 80% of the limit, a calm note.
    await user.click(screen.getByRole("button", { name: "Bottle (500 ml)" }));
    expect(await count()).toHaveTextContent("1.0 L of the 1.5 L limit");
    expect(screen.queryByText(/close to the daily limit/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Glass (250 ml)" }));
    expect(await count()).toHaveTextContent("You're close to the daily limit.");
    noNudge();
    await user.click(screen.getByRole("button", { name: "Glass (250 ml)" }));
    expect(await count()).toHaveTextContent("You've reached the daily limit.");
    await user.click(screen.getByRole("button", { name: "Glass (250 ml)" }));
    expect(await count()).toHaveTextContent("1.75 L of the 1.5 L limit");
    expect(await count()).toHaveTextContent("You're over the daily limit for today.");
    noNudge();
  });

  test("logs, edits and removes last night's sleep by hours", async () => {
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

  test("works out hours from bedtime and wake-up time across midnight, and checks both are given", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage();
    const section = await sleepSection();
    const hours = within(section).getByLabelText("Hours slept");

    fireEvent.change(within(section).getByLabelText("Bedtime"), { target: { value: "23:30" } });
    expect(hours).toHaveAttribute("readonly");
    expect(hours).toHaveAccessibleDescription("Worked out from bedtime and wake-up time.");
    await user.click(within(section).getByLabelText("Okay"));
    await user.click(within(section).getByRole("button", { name: "Save sleep" }));
    expect(within(section).getByText("Enter both bedtime and wake-up time, or clear them to type the hours.")).toBeInTheDocument();
    expect(within(section).getByLabelText("Wake-up time")).toHaveFocus();

    fireEvent.change(within(section).getByLabelText("Wake-up time"), { target: { value: "23:30" } });
    await user.click(within(section).getByRole("button", { name: "Save sleep" }));
    expect(within(section).getByText(/Bedtime and wake-up time can't be the same/)).toBeInTheDocument();

    fireEvent.change(within(section).getByLabelText("Wake-up time"), { target: { value: "06:45" } });
    expect(hours).toHaveValue(7.25);
    expect(within(section).getByText("That's 7.3 hours.")).toBeInTheDocument();
    await user.click(within(section).getByRole("button", { name: "Save sleep" }));
    expect(fake.calls).toContainEqual(["saveSleep", "self", TODAY, { bedtime: "23:30", wakeTime: "06:45", quality: 3, note: "" }]);
    expect(await within(section).findByText("7.3 hours")).toBeInTheDocument();
    expect(within(section).getByText("23:30 to 06:45")).toBeInTheDocument();

    // Editing keeps the times; clearing them goes back to typing the hours.
    await user.click(within(section).getByRole("button", { name: "Edit" }));
    expect(within(section).getByLabelText("Bedtime")).toHaveValue("23:30");
    await user.click(within(section).getByRole("button", { name: "Clear times" }));
    expect(within(section).getByLabelText("Hours slept")).not.toHaveAttribute("readonly");
    await user.type(within(section).getByLabelText("Hours slept"), "8");
    await user.click(within(section).getByRole("button", { name: "Save sleep" }));
    expect(await within(section).findByText("8 hours")).toBeInTheDocument();
    expect(within(section).queryByText(/ to \d{2}:\d{2}$/)).not.toBeInTheDocument();
    expect(fake.calls).toContainEqual(["saveSleep", "self", TODAY, { hours: 8, quality: 3, note: "" }]);
  });

  test("shows the week as charts in litres and hours, a table, and one gentle observation", async () => {
    fake.seedGoal("self", { type: "atLeast", ml: 1500 });
    [[6, 1000], [5, 1500], [4, 2000], [3, 250], [0, 750]].forEach(([ago, ml]) => fake.seedWater("self", daysAgo(ago), ml));
    [[5, 4], [4, 4.5], [3, 3], [1, 7.5]].forEach(([ago, hours]) => fake.seedSleep("self", daysAgo(ago), hours, 2));
    renderPage();

    const waterChart = await screen.findByRole("figure", { name: "Fluids" });
    expect(within(waterChart).getByText("Average fluids this week: 1.1 L a day, over 5 days logged.")).toBeInTheDocument();
    const rows = within(within(waterChart).getByRole("table")).getAllByRole("row").slice(1).map((row) => row.textContent);
    expect(rows[2]).toMatch(/2\.0 L$/);
    expect(rows[4]).toMatch(/Not logged$/);
    const sleepChart = screen.getByRole("figure", { name: "Sleep" });
    expect(within(sleepChart).getByText("Average sleep this week: 4.8 hours, over 4 nights logged.")).toBeInTheDocument();

    // One observation only: three short nights (the goal days would be the second, unused one).
    expect(screen.getByText("You've slept under 5 hours on 3 nights this week.")).toBeInTheDocument();
    expect(screen.queryByText(/water goal on/)).not.toBeInTheDocument();
  });

  test("observations follow the goal type: days over a limit, never days a limit was \"reached\"", async () => {
    fake.seedGoal("self", { type: "atMost", ml: 1500 });
    [[4, 1600], [3, 1800], [2, 1700], [1, 900]].forEach(([ago, ml]) => fake.seedWater("self", daysAgo(ago), ml));
    renderPage();
    expect(await screen.findByText("You went over the daily limit on 3 days this week.")).toBeInTheDocument();
    expect(screen.queryByText(/water goal on/)).not.toBeInTheDocument();
  });

  test("the summary for a doctor: the last 14 days in one table, printable", async () => {
    const user = userEvent.setup({ delay: null });
    const print = jest.spyOn(window, "print").mockImplementation(() => {});
    fake.seedGoal("self", { type: "atMost", ml: 1500 });
    fake.seedWater("self", TODAY, [250, 500]);
    fake.seedWater("self", daysAgo(13), 1200);
    fake.seedWater("self", daysAgo(20), 3000);
    fake.seedSleep("self", daysAgo(1), 7.33, 4, "Woke at 3", { bedtime: "23:40", wakeTime: "07:00" });
    fake.seedSleep("self", daysAgo(5), 6, 2);
    renderPage();

    const section = await screen.findByRole("region", { name: "Summary for your doctor" });
    expect(within(section).queryByRole("table")).not.toBeInTheDocument();
    await user.click(within(section).getByRole("button", { name: "Show the summary" }));

    const heading = await within(section).findByRole("heading", { level: 3, name: "Water and sleep: Demo User" });
    expect(heading).toHaveFocus();
    expect(fake.calls).toContainEqual(["getHistory", "self", TODAY, 14]);
    const facts = section.querySelector("dl").textContent;
    expect(facts).toContain("Period29 September 2026 to 12 October 2026");
    expect(facts).toContain("Daily fluid goalStay under 1.5 L a day");
    expect(facts).toContain("Average fluids0.975 L a day (2 of 14 days logged)");
    expect(facts).toContain("Average sleep6.7 hours a night (2 of 14 nights logged)");

    const table = within(section).getByRole("table", { name: "Fluids and sleep, day by day (newest first)" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Date", "Fluids", "Sleep", "Bedtime to wake-up", "Sleep quality", "Note"]);
    const rows = within(table).getAllByRole("row").slice(1).map((row) => Array.from(row.querySelectorAll("th, td"), (cell) => cell.textContent));
    expect(rows).toHaveLength(14);
    expect(rows[0]).toEqual(["Mon 12 Oct", "0.75 L", "Not logged", "", "", ""]);
    expect(rows[1]).toEqual(["Sun 11 Oct", "Not logged", "7.3 hours", "23:40 to 07:00", "Well", "Woke at 3"]);
    expect(rows[13]).toEqual(["Tue 29 Sep", "1.2 L", "Not logged", "", "", ""]);
    expect(within(section).getByText(/Self-reported in Nabad, not measured by a clinician\. Made on 12 October 2026\./)).toBeInTheDocument();

    await user.click(within(section).getByRole("button", { name: "Print or save as PDF" }));
    expect(print).toHaveBeenCalledTimes(1);
    await user.click(within(section).getByRole("button", { name: "Close summary" }));
    expect(within(section).queryByRole("table")).not.toBeInTheDocument();
    print.mockRestore();
  });

  test("follows the header profile switcher", async () => {
    const user = userEvent.setup({ delay: null });
    const child = await fakeProfileApi.addLinkedProfile({ fullName: "Sami Haddad", dateOfBirth: "2018-04-02", relationship: "child" });
    fake.seedWater("self", TODAY, 1250);
    fake.seedWater(child.id, TODAY, 500);
    fake.seedGoal(child.id, { type: "atLeast", ml: 1000 });
    fake.seedSleep(child.id, TODAY, 10, 5);
    renderPage();

    expect(await count()).toHaveTextContent("1.25 L today");
    await user.selectOptions(screen.getByLabelText("Active profile"), child.id);

    expect(await screen.findByRole("heading", { level: 1, name: "Water and sleep for Sami Haddad" })).toBeInTheDocument();
    expect(screen.getByText("Acting as: Sami Haddad (child)")).toBeInTheDocument();
    expect(await count()).toHaveTextContent("0.5 L of 1.0 L");
    expect(within(await sleepSection()).getByText("10 hours")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Glass (250 ml)" }));
    expect(await count()).toHaveTextContent("0.75 L of 1.0 L");
    expect(fake.calls).toContainEqual(["addDrink", child.id, TODAY, 250]);
    expect(fake.totalOn("self", TODAY)).toBe(1250);

    await user.click(screen.getByRole("button", { name: "Show the summary" }));
    expect(await screen.findByRole("heading", { level: 3, name: "Water and sleep: Sami Haddad" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Active profile"), "self");
    expect(await screen.findByRole("heading", { level: 1, name: "Water and sleep" })).toBeInTheDocument();
    expect(await count()).toHaveTextContent("1.25 L today");
    expect(within(await sleepSection()).getByLabelText("Hours slept")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /day by day \(newest first\)/ })).not.toBeInTheDocument();
  });

  test("uses the family member's name in the sleep question, goal hint and limit warning", async () => {
    const user = userEvent.setup({ delay: null });
    const child = await fakeProfileApi.addLinkedProfile({ fullName: "Sami Haddad", dateOfBirth: "2018-04-02", relationship: "child" });
    fake.seedGoal(child.id, { type: "atMost", ml: 1000 });
    fake.seedWater(child.id, TODAY, 900);
    localStorage.setItem("nabad-active-profile-id", child.id);
    renderPage();
    expect(await screen.findByRole("group", { name: "How well did Sami Haddad sleep?" })).toBeInTheDocument();
    expect(await count()).toHaveTextContent("Sami Haddad is close to the daily limit.");
    await user.click(screen.getByRole("button", { name: "Change goal" }));
    expect(screen.getByLabelText("Amount a day")).toHaveAccessibleDescription(/Only if a goal suits Sami Haddad\. If a doctor has given them a fluid limit/);
    expect(screen.getByLabelText("Stay under (a fluid limit)")).toBeChecked();
    expect(screen.getByLabelText("Amount a day")).toHaveValue(1);
  });

  test("has the page title and dashboard logo link, and is only for signed-in users", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("link", { name: /Nabad/ })).toHaveAttribute("href", "/dashboard");
    expect(WaterAndSleepPage.requireSignIn).toBe(true);
  });
});
