import { formatDate } from "../lib/dates";

describe("formatDate", () => {
  test("shows a date the way people write it", () => {
    expect(formatDate("1984-05-02")).toBe("2 May 1984");
    expect(formatDate("2016-12-31")).toBe("31 December 2016");
  });

  test("never shifts the day with the time zone", () => {
    expect(formatDate("2000-01-01")).toBe("1 January 2000");
  });

  test("leaves anything that isn't a date unchanged", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("not a date")).toBe("not a date");
  });
});

import { beirutDayString, formatDateTime, formatTime } from "../lib/dates";

// Beirut is UTC+2 in winter and UTC+3 in summer (daylight saving ends on the last Sunday of October).
describe("timestamps are shown in Beirut time, whatever the device's time zone", () => {
  test("a winter check just after midnight in Beirut keeps its Beirut day (the visit prep bug)", () => {
    // 01:44 on 11 November in Beirut is 23:44 on 10 November in UTC.
    expect(formatDate("2026-11-10T23:44:00Z")).toBe("11 November 2026");
    expect(formatDateTime("2026-11-10T23:44:00Z")).toBe("11 November 2026, 01:44");
    expect(beirutDayString("2026-11-10T23:44:00Z")).toBe("2026-11-11");
  });

  test("winter midnight falls at 22:00 UTC", () => {
    expect(formatDateTime("2026-11-10T21:59:00Z")).toBe("10 November 2026, 23:59");
    expect(formatDateTime("2026-11-10T22:00:00Z")).toBe("11 November 2026, 00:00");
  });

  test("summer midnight falls at 21:00 UTC", () => {
    expect(formatDateTime("2026-07-14T20:59:00Z")).toBe("14 July 2026, 23:59");
    expect(formatDateTime("2026-07-14T21:00:00Z")).toBe("15 July 2026, 00:00");
  });

  test("New Year's Eve rolls over the year in Beirut", () => {
    expect(formatDate("2026-12-31T22:30:00Z")).toBe("1 January 2027");
  });

  test("accepts Date objects and milliseconds, never shows seconds, and uses a 24-hour clock", () => {
    const moment = new Date("2026-11-11T12:05:59Z");
    expect(formatDateTime(moment)).toBe("11 November 2026, 14:05");
    expect(formatDateTime(moment.getTime())).toBe("11 November 2026, 14:05");
    expect(formatTime(moment)).toBe("14:05");
  });

  test("date-only values are never shifted, even though they look like UTC midnight", () => {
    expect(formatDate("2026-11-11")).toBe("11 November 2026");
    expect(beirutDayString("2026-11-11")).toBe("2026-11-11");
  });

  test("missing or invalid timestamps give an empty string", () => {
    expect(formatDateTime(undefined)).toBe("");
    expect(formatDateTime("")).toBe("");
    expect(formatDateTime("not a date")).toBe("");
    expect(formatTime(null)).toBe("");
  });
});

import { longDate } from "../lib/careCircleApi";
import { timeAgo } from "../lib/notificationApi";
import { formatDateTime as overviewDateTime } from "../lib/medicationOverview";
import { sourceText } from "../lib/healthProfile";

describe("pages that show timestamps use the Beirut day around midnight", () => {
  const lateNight = "2026-11-10T23:44:00Z"; // 01:44 on 11 November in Beirut
  test("care circle dates", () => expect(longDate(lateNight)).toBe("11 November 2026"));
  test("older notifications", () => expect(timeAgo(lateNight, new Date("2026-11-14T12:00:00Z"))).toBe("11 November 2026"));
  test("medication overview last updated and printed times", () => expect(overviewDateTime(lateNight)).toBe("11 November 2026, 01:44"));
  test("My health sources", () => {
    expect(sourceText({ category: "sex", value: "male", source: "user", status: "confirmed", recordedAt: lateNight, updatedAt: lateNight })).toBe("You added this, 11 November 2026");
  });
});
