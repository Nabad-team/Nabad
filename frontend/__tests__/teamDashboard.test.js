// SCRUM-311: the team's usage dashboard. Anonymous daily totals, team members only.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TeamDashboardPage, { dayLabel } from "../pages/team-dashboard";
import { getUsageSummary } from "../lib/usageApi";

jest.mock("../lib/usageApi", () => ({ getUsageSummary: jest.fn() }));
jest.mock("../components/ProfileHeader", () => () => <header>Navigation</header>);

const days = (count, fill) => Array.from({ length: count }, (_, i) => {
  const day = new Date(Date.UTC(2026, 10, 10) - (count - 1 - i) * 86400000).toISOString().slice(0, 10);
  return { day, assessments: 0, sessionsStarted: 0, followupAssessments: 0, newAccounts: 0, ...fill(i) };
});
const summary = (count) => {
  const daily = days(count, (i) => (i === count - 1 ? { assessments: 5, sessionsStarted: 3, followupAssessments: 2, newAccounts: 1 } : i === 0 ? { assessments: 1200, sessionsStarted: 1200 } : {}));
  const totals = { assessments: 0, sessionsStarted: 0, followupAssessments: 0, newAccounts: 0 };
  for (const row of daily) for (const key of Object.keys(totals)) totals[key] += row[key];
  return { timeZone: "UTC", from: daily[0].day, to: daily.at(-1).day, totals, daily, generatedAt: "2026-11-10T09:30:00.000Z" };
};

beforeEach(() => {
  jest.resetAllMocks();
  getUsageSummary.mockImplementation((range) => Promise.resolve(summary(range)));
});

test("needs sign-in and shows the totals for the last 30 days by default", async () => {
  render(<TeamDashboardPage />);
  expect(TeamDashboardPage.requireSignIn).toBe(true);
  const totals = await screen.findByRole("list", { name: "Totals for the period" });
  expect(getUsageSummary).toHaveBeenCalledWith(30, expect.any(AbortSignal));
  expect(within(totals).getByText("1,203").nextSibling).toHaveTextContent("Symptom checks started");
  expect(within(totals).getByText("1,205").nextSibling).toHaveTextContent("Assessments completed");
  expect(within(totals).getByText("Follow-up rounds").previousSibling).toHaveTextContent("2");
  expect(within(totals).getByText("New accounts").previousSibling).toHaveTextContent("1");
  expect(screen.getByText(/12 Oct to 10 Nov \(days in UTC\)/)).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Last 30 days" })).toBeChecked();
});

test("each chart says what it shows in words, and a table has every day", async () => {
  render(<TeamDashboardPage />);
  const chart = await screen.findByRole("figure", { name: "Symptom checks started per day" });
  expect(chart).toHaveTextContent("1,203 in 30 days. Busiest day: 12 Oct (1,200).");
  expect(screen.getByRole("figure", { name: "New accounts per day" })).toHaveTextContent("1 in 30 days. Busiest day: 10 Nov (1).");
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(31); // header + 30 days
  expect(within(table).getByRole("rowheader", { name: "10 Nov" }).parentElement).toHaveTextContent("10 Nov3521");
});

test("switching the period loads 7 or 90 days", async () => {
  const user = userEvent.setup();
  render(<TeamDashboardPage />);
  await screen.findByRole("list", { name: "Totals for the period" });
  await user.click(screen.getByRole("radio", { name: "Last 7 days" }));
  expect(getUsageSummary).toHaveBeenLastCalledWith(7, expect.any(AbortSignal));
  expect(await screen.findByText(/4 Nov to 10 Nov/)).toBeInTheDocument();
  await user.click(screen.getByRole("radio", { name: "Last 90 days" }));
  expect(getUsageSummary).toHaveBeenLastCalledWith(90, expect.any(AbortSignal));
  expect(await screen.findByText(/13 Aug to 10 Nov/)).toBeInTheDocument();
});

test("a period with no activity says so instead of drawing an empty chart as if it were data", async () => {
  getUsageSummary.mockResolvedValue({ ...summary(7), totals: { assessments: 0, sessionsStarted: 0, followupAssessments: 0, newAccounts: 0 }, daily: days(7, () => ({})) });
  render(<TeamDashboardPage />);
  expect(await screen.findByRole("figure", { name: "Symptom checks started per day" })).toHaveTextContent("None in this period.");
});

test("someone who is not on the team sees that the page is for the team, and no numbers", async () => {
  getUsageSummary.mockRejectedValue(Object.assign(new Error("Route not found."), { status: 404 }));
  render(<TeamDashboardPage />);
  expect(await screen.findByText("This page is for the Nabad team")).toBeInTheDocument();
  expect(screen.queryByText("Loading usage numbers...")).not.toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Totals for the period" })).not.toBeInTheDocument();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
});

test("other failures show the error and keep the period choice", async () => {
  getUsageSummary.mockRejectedValue(Object.assign(new Error("Nabad took too long to respond."), { status: 0 }));
  render(<TeamDashboardPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Nabad took too long to respond.");
  expect(screen.getByRole("radio", { name: "Last 30 days" })).toBeInTheDocument();
});

test("day labels are in English and in UTC, like the counts", () => {
  expect(dayLabel("2026-11-10")).toBe("10 Nov");
  expect(dayLabel("2026-01-01")).toBe("1 Jan");
});
