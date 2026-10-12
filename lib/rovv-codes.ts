/**
 * Reading a pasted list of ticket codes (the owner, 12 October: twenty
 * different 100%-off codes, pasted at once and handed out one per winner).
 *
 * Shared by the console, which shows what it found before anything is sent,
 * and the route, which reads it again. Codes are separated by new lines,
 * commas, semicolons, tabs or spaces, so a column copied from a spreadsheet
 * and a line typed by hand both work. A code is what the ticket page gives:
 * letters, numbers, dashes and underscores.
 *
 * "Repeated" ignores case, on purpose: if the ticket page treats ABC1 and
 * abc1 as one code, handing both out would give two winners the same pass.
 */
export const TICKET_CODE = /^[A-Za-z0-9_-]{3,64}$/;

export interface PastedCodes {
  /** Every well-formed code, in the order pasted, first sighting only. */
  codes: string[];
  /** Pieces that are not the shape of a code. */
  invalid: string[];
  /** Codes that appear more than once. */
  repeated: string[];
}

export function readTicketCodes(text: string): PastedCodes {
  const pieces = text.split(/[\s,;]+/).filter(Boolean);
  const codes: string[] = [];
  const invalid: string[] = [];
  const repeated: string[] = [];
  const seen = new Set<string>();
  for (const piece of pieces) {
    if (!TICKET_CODE.test(piece)) {
      invalid.push(piece);
      continue;
    }
    const key = piece.toUpperCase();
    if (seen.has(key)) {
      if (!repeated.includes(piece)) repeated.push(piece);
      continue;
    }
    seen.add(key);
    codes.push(piece);
  }
  return { codes, invalid, repeated };
}
