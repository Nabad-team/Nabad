// Unit tests for the water and sleep wording and weekly summaries (lib/wellbeing.js).
import {
  litresText, waterCountText, waterGoalText, limitStatus, goalText, weekSummary, weekObservation, averages,
  hoursText, hoursBetween, sleepTimesText, sleptText, shortDay, shortDate, timeText,
} from "../lib/wellbeing";

const day = (date, totalMl = null, hours = null) => ({ date, totalMl, sleep: hours === null ? null : { date, hours, quality: 3, note: "" } });
const atLeast = (ml) => ({ type: "atLeast", ml });
const atMost = (ml) => ({ type: "atMost", ml });

describe("fluid wording", () => {
  test("shows litres without rounding away millilitres", () => {
    expect(litresText(250)).toBe("0.25 L");
    expect(litresText(1750)).toBe("1.75 L");
    expect(waterCountText(250, atLeast(2000))).toBe("0.25 L of 2.0 L");
    expect(waterGoalText(250, atLeast(2000))).toBe("1.75 L more to reach the goal.");
    expect(litresText(1250)).toBe("1.25 L");
    expect(litresText(2000)).toBe("2.0 L");
    expect(litresText(80)).toBe("0.08 L");
    expect(litresText(0)).toBe("0.0 L");
  });

  test("shows the goal or limit only when one is set", () => {
    expect(waterCountText(0, null)).toBe("Nothing logged yet today");
    expect(waterCountText(1300, null)).toBe("1.3 L today");
    expect(waterCountText(1300, atLeast(2000))).toBe("1.3 L of 2.0 L");
    expect(waterCountText(1300, atMost(1500))).toBe("1.3 L of the 1.5 L limit");
    expect(goalText(atLeast(2000))).toBe("Drink at least 2.0 L a day");
    expect(goalText(atMost(1500))).toBe("Stay under 1.5 L a day");
    expect(goalText(null)).toBe("");
  });

  test("a \"Drink at least\" goal: gentle wording, and never any without a goal", () => {
    expect(waterGoalText(1300, null)).toBe("");
    expect(waterGoalText(1300, atLeast(2000))).toBe("0.7 L more to reach the goal.");
    expect(waterGoalText(2100, atLeast(2000))).toBe("Goal reached for today.");
    expect(limitStatus(2100, atLeast(2000))).toBe(null);
  });

  test("a \"Stay under\" limit: silent until close, then calm notes, and never how much is left", () => {
    const limit = atMost(1500);
    expect([0, 1000, 1199].map((ml) => limitStatus(ml, limit))).toEqual([null, null, null]);
    expect([1200, 1499].map((ml) => limitStatus(ml, limit))).toEqual(["near", "near"]);
    expect(limitStatus(1500, limit)).toBe("reached");
    expect(limitStatus(1501, limit)).toBe("over");
    expect(waterGoalText(1000, limit)).toBe("");
    expect(waterGoalText(1300, limit)).toBe("You're close to the daily limit.");
    expect(waterGoalText(1500, limit)).toBe("You've reached the daily limit.");
    expect(waterGoalText(1800, limit)).toBe("You're over the daily limit for today.");
    expect(waterGoalText(1300, limit, "Sami")).toBe("Sami is close to the daily limit.");
    expect(waterGoalText(1500, limit, "Sami")).toBe("Sami has reached the daily limit.");
    for (const ml of [0, 500, 1000, 1300, 1500, 1800]) {
      expect(`${waterCountText(ml, limit)} ${waterGoalText(ml, limit)}`).not.toMatch(/more|left|reach the|keep|drink up/i);
    }
  });
});

describe("sleep", () => {
  test("works out hours from bedtime and wake-up time, across midnight", () => {
    expect(hoursBetween("23:30", "07:00")).toBe(7.5);
    expect(hoursBetween("22:00", "06:15")).toBe(8.25);
    expect(hoursBetween("01:00", "08:00")).toBe(7);
    expect(hoursBetween("13:00", "15:30")).toBe(2.5);
    expect(hoursBetween("23:40", "07:00")).toBe(7.33);
    expect(hoursBetween("23:59", "00:00")).toBe(0.02);
  });

  test("needs two different, valid times", () => {
    expect(hoursBetween("23:00", "23:00")).toBe(null);
    expect(hoursBetween("23:00", "")).toBe(null);
    expect(hoursBetween("", "07:00")).toBe(null);
    expect(hoursBetween("24:00", "07:00")).toBe(null);
    expect(hoursBetween("7:00", "23:00")).toBe(null);
  });

  test("shows the times only when they were entered", () => {
    expect(sleepTimesText({ bedtime: "23:30", wakeTime: "07:00" })).toBe("23:30 to 07:00");
    expect(sleepTimesText({ bedtime: null, wakeTime: null })).toBe("");
    expect(sleepTimesText(null)).toBe("");
  });
});

describe("weekly summaries", () => {
  test("averages only the days that were logged", () => {
    const summary = weekSummary([day("2026-10-06", 1500, 6), day("2026-10-07", 250, 7), day("2026-10-08"), day("2026-10-09", 1000)]);
    expect(summary.hasData).toBe(true);
    expect(summary.water).toBe("Average fluids this week: 0.917 L a day, over 3 days logged.");
    expect(summary.sleep).toBe("Average sleep this week: 6.5 hours, over 2 nights logged.");
    expect(averages([day("2026-10-06", 1500, 6), day("2026-10-07")])).toEqual({ waterDays: 1, sleepDays: 1, waterMl: 1500, sleepHours: 6 });
  });

  test("says so plainly when nothing was logged", () => {
    const summary = weekSummary([day("2026-10-06"), day("2026-10-07")]);
    expect(summary).toEqual({ hasData: false, water: "No fluids logged this week.", sleep: "No sleep logged this week." });
  });
});

describe("weekly observation", () => {
  const nights = (...hours) => hours.map((h, i) => day(`2026-10-0${i + 1}`, null, h));
  const fluids = (...ml) => ml.map((amount, i) => day(`2026-10-0${i + 1}`, amount));

  test("mentions short nights only when there were at least three", () => {
    expect(weekObservation(nights(4, 4.5, 3, 8), null)).toBe("You've slept under 5 hours on 3 nights this week.");
    expect(weekObservation(nights(4, 4.5, 8, 8), null)).toBe("");
    expect(weekObservation(nights(5, 5, 5, 5), null)).toBe("", "5 hours is not under 5");
    expect(weekObservation(nights(4, 4, 4, 4), null, "Sami")).toBe("Sami has slept under 5 hours on 4 nights this week.");
  });

  test("a \"Drink at least\" goal: the days it was reached", () => {
    const week = fluids(2000, 2100, 2000, 500);
    expect(weekObservation(week, null)).toBe("");
    expect(weekObservation(week, atLeast(2000))).toBe("You reached your water goal on 3 days this week.");
    expect(weekObservation(week, atLeast(2000), "Sami")).toBe("Sami reached the water goal on 3 days this week.");
  });

  test("a \"Stay under\" limit: the days over it first, otherwise the days within it, never \"reached\"", () => {
    expect(weekObservation(fluids(1600, 1800, 1700, 900), atMost(1500))).toBe("You went over the daily limit on 3 days this week.");
    expect(weekObservation(fluids(1600, 1800, 1700), atMost(1500), "Sami")).toBe("Sami went over the daily limit on 3 days this week.");
    expect(weekObservation(fluids(1000, 1500, 1200, 1800), atMost(1500))).toBe("You stayed within the daily limit on 3 days this week.");
    expect(weekObservation(fluids(1000, 1800), atMost(1500))).toBe("");
    // A big day under a limit is never praised as a goal reached.
    expect(weekObservation(fluids(1400, 1450, 1500), atMost(1500))).not.toMatch(/goal/);
  });

  test("never more than one observation: short nights come first", () => {
    const both = fluids(2000, 2000, 2000, 2000).map((d) => ({ ...d, sleep: { hours: 4, quality: 2, note: "" } }));
    expect(weekObservation(both, atLeast(2000))).toBe("You've slept under 5 hours on 4 nights this week.");
  });
});

test("formats hours, quality, dates and times", () => {
  expect(hoursText(1)).toBe("1 hour");
  expect(hoursText(7.5)).toBe("7.5 hours");
  expect(hoursText(7.33)).toBe("7.3 hours");
  expect(sleptText(1)).toBe("Slept very poorly");
  expect(sleptText(5)).toBe("Slept very well");
  expect(shortDay("2026-10-12")).toBe("Mon");
  expect(shortDate("2026-10-12")).toBe("Mon 12 Oct");
  expect(timeText(new Date(2026, 9, 12, 8, 5).toISOString())).toBe("08:05");
  expect(timeText(new Date(2026, 9, 12, 23, 40).toISOString())).toBe("23:40");
});
