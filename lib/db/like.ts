/**
 * A LIKE pattern that matches the typed text literally, anywhere in the value.
 *
 * Without escaping, a search for "a_b" also matches "axb" and a lone "%"
 * matches every row, which reads as a search that ignored what was typed.
 * Postgres treats backslash as the LIKE escape character by default, so the
 * three characters that mean something to LIKE are prefixed with one.
 */
export function likeContaining(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
