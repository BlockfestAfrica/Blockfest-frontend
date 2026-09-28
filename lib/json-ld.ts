// U+2028 and U+2029, from their code points because the characters themselves
// are invisible in an editor.
const LINE_SEPARATORS = String.fromCharCode(0x2028, 0x2029);
const HTML_SIGNIFICANT = new RegExp(`[<>&${LINE_SEPARATORS}]`, "g");

/**
 * The body of a <script type="application/ld+json">, safe to write as HTML.
 *
 * JSON.stringify alone is not. dangerouslySetInnerHTML puts the string into
 * the document verbatim, and the HTML parser ends a script element at the
 * first "</script" it meets, whether or not that sits inside a JSON string.
 * The newsletter page builds its JSON-LD from the Substack feed, so a post
 * titled "</script><img src=x onerror=...>" would close the element and have
 * the rest of its title parsed as markup, under a policy that allows inline
 * script, on the origin that also hosts the console.
 *
 * So five characters go out as \u escapes instead: <, which starts both
 * "</script" and "<!--"; > and &, which HTML reads elsewhere; and U+2028 and
 * U+2029, which end a line in older JavaScript parsers. JSON reads each escape
 * back as the same character, so crawlers get exactly the data they got
 * before and only the page source changes. It is the set Next escapes in its
 * own inline data.
 *
 * Every JSON-LD script on the site goes through here, including the ones that
 * only hold constants, so the next page to put fetched data into one does not
 * have to know about any of this. __tests__/unit/json-ld.test.ts fails the
 * build if one bypasses it.
 */
export function jsonLd(data: object): string {
  return JSON.stringify(data).replace(
    HTML_SIGNIFICANT,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`
  );
}
