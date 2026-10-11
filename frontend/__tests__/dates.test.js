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
