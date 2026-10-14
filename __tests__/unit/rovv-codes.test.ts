/**
 * Reading a pasted list of ticket codes (lib/rovv-codes.ts), the way the
 * console previews it and the route reads it: twenty different codes, one
 * per winner, whatever separates them.
 */
import { describe, expect, it } from "vitest";
import { readTicketCodes } from "@/lib/rovv-codes";

describe("a pasted list of codes", () => {
  it("is read in order from lines, commas, semicolons, tabs or spaces", () => {
    expect(readTicketCodes("BUIDL-1\nBUIDL-2, BUIDL-3;BUIDL-4\tBUIDL-5  BUIDL_6\r\n").codes).toEqual([
      "BUIDL-1",
      "BUIDL-2",
      "BUIDL-3",
      "BUIDL-4",
      "BUIDL-5",
      "BUIDL_6",
    ]);
  });

  it("names anything that is not a code", () => {
    expect(readTicketCodes("BUIDL-1 B@D! ok").invalid).toEqual(["B@D!", "ok"]);
  });

  it("catches a code twice, even in another case, so no pass goes to two people", () => {
    const r = readTicketCodes("ABC123\nDEF456\nabc123");
    expect(r.codes).toEqual(["ABC123", "DEF456"]);
    expect(r.repeated).toEqual(["abc123"]);
  });

  it("is empty for nothing", () => {
    expect(readTicketCodes("  \n ")).toEqual({ codes: [], invalid: [], repeated: [] });
  });

  it("refuses the column headings a spreadsheet copy brings, so they are never handed out as codes", () => {
    const r = readTicketCodes("Discount Code\nBUIDL-7Q2K\nBUIDL-9XW4");
    expect(r.codes).toEqual(["BUIDL-7Q2K", "BUIDL-9XW4"]);
    expect(r.invalid).toEqual(["Discount", "Code"]);
  });
});
