// Unit tests for the water and sleep wording and weekly summaries (lib/wellbeing.js).
import { waterCountText, waterGoalText, weekSummary, weekObservation, hoursText, sleptText, shortDay } from "../lib/wellbeing";

const day = (date, glasses = null, hours = null) => ({ date, glasses, sleep: hours === null ? null : { date, hours, quality: 3, note: "" } });

describe("water wording", () => {
  test("shows the goal only when one is set", () => {
    expect(waterCountText(0, null)).toBe("No glasses yet today");
    expect(waterCountText(1, null)).toBe("1 glass today");
    expect(waterCountText(6, 8)).toBe("6 of 8 glasses");
  });

  test("never nudges without a goal, and stays gentle with one", () => {
    expect(waterGoalText(0, null)).toBe("");
    expect(waterGoalText(6, 8)).toBe("2 more to reach your goal.");
    expect(waterGoalText(9, 8)).toBe("You've reached your goal for today.");
  });
});

describe("weekly summaries", () => {
  test("averages only the days that were logged", () => {
    const summary = weekSummary([day("2026-10-06", 4, 6), day("2026-10-07", 0, 7), day("2026-10-08"), day("2026-10-09", 5)]);
    expect(summary.hasData).toBe(true);
    expect(summary.water).toBe("Average water this week: 3 glasses a day, over 3 days logged.");
    expect(summary.sleep).toBe("Average sleep this week: 6.5 hours, over 2 nights logged.");
  });

  test("says so plainly when nothing was logged", () => {
    const summary = weekSummary([day("2026-10-06"), day("2026-10-07")]);
    expect(summary).toEqual({ hasData: false, water: "No water logged this week.", sleep: "No sleep logged this week." });
  });
});

describe("weekly observation", () => {
  const nights = (...hours) => hours.map((h, i) => day(`2026-10-0${i + 1}`, null, h));

  test("mentions short nights only when there were at least three", () => {
    expect(weekObservation(nights(4, 4.5, 3, 8), null)).toBe("You've slept under 5 hours on 3 nights this week.");
    expect(weekObservation(nights(4, 4.5, 8, 8), null)).toBe("");
    expect(weekObservation(nights(5, 5, 5, 5), null)).toBe("", "5 hours is not under 5");
  });

  test("names the family member", () => {
    expect(weekObservation(nights(4, 4, 4, 4), null, "Sami")).toBe("Sami has slept under 5 hours on 4 nights this week.");
  });

  test("mentions water goal days only with a goal, and never more than one observation", () => {
    const water = [day("2026-10-01", 8), day("2026-10-02", 9), day("2026-10-03", 8), day("2026-10-04", 2)];
    expect(weekObservation(water, null)).toBe("");
    expect(weekObservation(water, 8)).toBe("You reached your water goal on 3 days this week.");
    expect(weekObservation(water, 8, "Sami")).toBe("Sami reached the water goal on 3 days this week.");
    const both = water.map((d, i) => ({ ...d, sleep: { hours: 4, quality: 2, note: "" } }));
    expect(weekObservation(both, 8)).toBe("You've slept under 5 hours on 4 nights this week.");
  });
});

test("formats hours, quality and weekdays", () => {
  expect(hoursText(1)).toBe("1 hour");
  expect(hoursText(7.5)).toBe("7.5 hours");
  expect(hoursText(6.25)).toBe("6.3 hours");
  expect(sleptText(1)).toBe("Slept very poorly");
  expect(sleptText(5)).toBe("Slept very well");
  expect(shortDay("2026-10-12")).toBe("Mon");
});
