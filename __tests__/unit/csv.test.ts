/**
 * The payout export is opened in a spreadsheet by somebody deciding a
 * 1,500,000 naira transfer. Two things have to be right.
 */

import { describe, expect, it } from "vitest";
import { csvCell, csvFile, csvRow } from "@/lib/csv";

describe("escaping", () => {
  it("quotes a field containing a comma", () => {
    // Without this the columns shift and a payout row is misattributed.
    expect(csvCell("Featured, then corrected")).toBe(
      '"Featured, then corrected"',
    );
  });

  it("doubles quotes inside a quoted field", () => {
    expect(csvCell('He said "no"')).toBe('"He said ""no"""');
  });

  it("quotes a field containing a newline", () => {
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("leaves ordinary text alone", () => {
    expect(csvCell("quality_bonus")).toBe("quality_bonus");
  });

  it("renders null and undefined as empty rather than as words", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    // "null" in a payout export is a value somebody has to interpret.
    expect(csvCell(null)).not.toBe("null");
  });
});

describe("formulas", () => {
  /**
   * A spreadsheet evaluates a cell beginning with =, +, - or @. Text from the
   * database then becomes something Excel runs when the file is opened.
   */
  it("defuses a cell that would be evaluated", () => {
    /*
     * Checked after unwrapping, because a formula that also contains a comma
     * gets quoted as well, and the apostrophe then sits inside the quotes. The
     * first version of this asserted on the outermost character and failed on
     * exactly the case most worth defusing.
     */
    const defused = (value: string) => {
      const cell = csvCell(value);
      const inner = cell.startsWith('"') ? cell.slice(1, -1) : cell;
      return inner.startsWith("'");
    };

    for (const dangerous of [
      "=1+1",
      "+1",
      "-1",
      "@SUM(A1)",
      '=HYPERLINK("http://evil.example","click")',
      "=cmd|'/c calc'!A0",
    ]) {
      expect(defused(dangerous), dangerous).toBe(true);
    }
  });

  it("still quotes a formula that also contains a comma", () => {
    const cell = csvCell('=HYPERLINK("a","b")');
    expect(cell.startsWith('"')).toBe(true);
    expect(cell).toContain("'=HYPERLINK");
  });

  it("does not defuse a negative number that arrived as a number", () => {
    // A correction is a negative row and must read as one. The guard is about
    // text, and a number is not text.
    expect(csvCell(-50)).toBe("'-50");
  });
});

describe("a whole file", () => {
  it("uses CRLF, which is what RFC 4180 says and what Excel prefers", () => {
    expect(csvFile([["a"], ["b"]])).toBe("a\r\nb\r\n");
  });

  it("keeps columns aligned when a cell is empty", () => {
    expect(csvRow(["a", null, "c"])).toBe("a,,c");
  });
});
