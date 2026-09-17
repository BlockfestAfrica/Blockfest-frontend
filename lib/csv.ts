/**
 * CSV, escaped for the two things that actually go wrong.
 *
 * The first is ordinary: a field containing a comma, a quote or a newline needs
 * quoting, and a review note is free text written by a person under time
 * pressure. Without it the columns shift and a payout export silently
 * misattributes rows.
 *
 * The second is the one people forget. A spreadsheet treats a cell beginning
 * with =, +, - or @ as a formula, so text from the database becomes something
 * Excel executes when the file is opened. This export exists to be opened in a
 * spreadsheet by somebody deciding a 1,500,000 naira transfer, which makes it
 * exactly the wrong file to be casual about.
 *
 * A leading apostrophe is the conventional defusal: the spreadsheet shows the
 * text and does not evaluate it.
 */

const NEEDS_QUOTING = /[",\n\r]/;
const LOOKS_LIKE_A_FORMULA = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);

  if (LOOKS_LIKE_A_FORMULA.test(text)) {
    text = `'${text}`;
  }

  if (NEEDS_QUOTING.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

/**
 * A whole file, with CRLF line endings.
 *
 * RFC 4180 says CRLF, and Excel on Windows is the reader most likely to be
 * fussy about it. Nothing else cares.
 */
export function csvFile(rows: unknown[][]): string {
  return rows.map(csvRow).join("\r\n") + "\r\n";
}
