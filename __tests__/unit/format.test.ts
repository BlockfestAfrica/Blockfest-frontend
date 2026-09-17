/**
 * One way of writing a number, and one way of writing a date.
 *
 * These were built at call sites and disagreed: the same amount appeared with a
 * currency symbol in one place and as bare digits in another, and three screens
 * a reviewer moves between wrote dates three ways.
 */

import { describe, expect, it } from "vitest";
import { closingAt, count, dateOnly, dateTime, naira } from "@/lib/format";

describe("money", () => {
  it("writes whole naira with a symbol and grouping", () => {
    expect(naira(1_500_000)).toContain("1,500,000");
    expect(naira(1_500_000)).toMatch(/₦|NGN/);
  });

  it("shows no kobo, because the prizes have none", () => {
    expect(naira(300_000)).not.toContain(".");
  });
});

describe("counts", () => {
  it("groups, so a six figure total is readable", () => {
    expect(count(128_456)).toBe("128,456");
  });

  it("leaves a small number alone", () => {
    expect(count(7)).toBe("7");
  });
});

describe("dates", () => {
  /**
   * The campaign's deadlines are to the second, and the server is not in Lagos.
   * A time rendered in the server's zone is wrong by an hour for everybody
   * reading it.
   */
  it("renders in Lagos regardless of where it runs", () => {
    // 23:30 UTC on the 20th is 00:30 on the 21st in Lagos.
    const crossesMidnight = new Date("2026-09-20T23:30:00Z");
    expect(dateTime(crossesMidnight)).toContain("21");
  });

  it("accepts a string as well as a Date", () => {
    expect(dateOnly("2026-09-14T10:00:00Z")).toBe(dateOnly(new Date("2026-09-14T10:00:00Z")));
  });

  it("names the weekday on a deadline, so it cannot be read as next week", () => {
    expect(closingAt("2026-09-20T22:59:59Z")).toMatch(
      /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/,
    );
  });
});
