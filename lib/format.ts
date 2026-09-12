/**
 * How numbers and dates are written, in one place.
 *
 * Every one of these was being built at the call site, and a few were built
 * inside a render, which constructs an Intl formatter per row. More to the
 * point they disagreed: the same amount appeared as ₦1,500,000 in one place and
 * 1500000 in another, and dates were written in three different orders on three
 * screens that a reviewer moves between.
 *
 * Constructed once at module scope. An Intl formatter is expensive to build and
 * free to reuse, so a table of two hundred rows builds none.
 *
 * en-NG throughout, with Africa/Lagos pinned. A time rendered in the server's
 * zone is a time that is wrong by an hour for everybody reading it, and the
 * campaign's deadlines are to the minute.
 */

const NAIRA = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const COUNT = new Intl.NumberFormat("en-NG");

const DATE_TIME = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Lagos",
});

const DATE_ONLY = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "long",
  timeZone: "Africa/Lagos",
});

const CLOSING = new Intl.DateTimeFormat("en-NG", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Lagos",
});

/** ₦1,500,000. Whole naira: the prizes have no kobo and never will. */
export const naira = (amount: number) => NAIRA.format(amount);

/** Grouped, so a six figure points total does not read as one long digit run. */
export const count = (value: number) => COUNT.format(value);

/** 12 Sept, 23:59 Lagos. For anything a reviewer scans down a column. */
export const dateTime = (value: Date | string) =>
  DATE_TIME.format(typeof value === "string" ? new Date(value) : value);

/** 12 September. For a single date in a sentence. */
export const dateOnly = (value: Date | string) =>
  DATE_ONLY.format(typeof value === "string" ? new Date(value) : value);

/**
 * Saturday, 20 September, 11:59 pm.
 *
 * Only for a deadline. submit_entry enforces the closing instant to the second,
 * so a creator posting at ten against a six o'clock close loses the week to a
 * formatting choice, and the weekday is what stops somebody reading it as next
 * week.
 */
export const closingAt = (value: Date | string) =>
  CLOSING.format(typeof value === "string" ? new Date(value) : value);
