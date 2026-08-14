export const SUBSTACK_URL = "https://blockfest.substack.com";
const FEED_URL = `${SUBSTACK_URL}/feed`;

/**
 * How long a fetched feed is served before Next refetches it.
 *
 * This is the whole update mechanism: publish on Substack and the post appears
 * here within the hour, with no redeploy and nothing to edit. A newsletter that
 * goes out every few weeks does not need a tighter window, and a stale page is
 * still served while the refetch happens, so Substack being down never shows a
 * visitor an error.
 */
const REVALIDATE_SECONDS = 3600;

/** Posts shorter than this are Substack placeholders, not issues. */
const MIN_BODY_CHARS = 400;

export interface NewsletterPost {
  title: string;
  url: string;
  /** ISO date, for <time dateTime>. */
  date: string;
  displayDate: string;
  excerpt: string;
  /** Longer, for the featured card, which has the room for it. */
  longExcerpt: string;
  coverImage?: string;
  readingMinutes: number;
}

function unwrap(value: string): string {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(
    new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i")
  );
  return m ? unwrap(m[1]) : undefined;
}

/** Entities that actually appear in Substack titles and copy. */
function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8230;|&hellip;/g, "…")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'");
}

function toPlainText(html: string): string {
  return decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * Substack serves covers through a Cloudinary-style transform URL, and the one
 * in the feed is sized for a full-width desktop post. Ask for a card-sized
 * image instead: most of this audience is on a phone, and a 1456px file to fill
 * a 360px card is most of a card's weight for nothing.
 */
function cardSizedImage(url: string): string {
  return url.replace(
    /(\/image\/fetch\/\$s_![^,]+!,)/,
    "$1w_640,c_limit,"
  );
}

/** Excerpt from the body, because Substack's own subtitle field is empty. */
function buildExcerpt(body: string, limit: number, fallback?: string): string {
  const text = toPlainText(body).replace(/^Hey Blockers,\s*/i, "");
  const source = text || (fallback ? toPlainText(fallback) : "");
  if (source.length <= limit) return source;
  const cut = source.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > limit * 0.65 ? lastSpace : cut.length)}…`;
}

/**
 * The published issues, newest first.
 *
 * Returns an empty array rather than throwing if the feed is unreachable, so a
 * Substack outage costs the page its list and nothing else — the subscribe form
 * and the link out still render.
 */
export async function getNewsletterPosts(): Promise<NewsletterPost[]> {
  let xml: string;
  try {
    const res = await fetch(FEED_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    xml = await res.text();
  } catch {
    return [];
  }

  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  return items
    .map((item): NewsletterPost | null => {
      const title = tag(item, "title");
      const url = tag(item, "link");
      const pubDate = tag(item, "pubDate");
      if (!title || !url || !pubDate) return null;

      const body = tag(item, "content:encoded") ?? "";
      if (body.length < MIN_BODY_CHARS) return null;

      const parsed = new Date(pubDate);
      if (Number.isNaN(parsed.getTime())) return null;

      const cover = item.match(/<enclosure[^>]*url="([^"]+)"/i)?.[1];
      const words = toPlainText(body).split(" ").length;

      return {
        title: decode(title),
        url,
        date: parsed.toISOString(),
        displayDate: parsed.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }),
        excerpt: buildExcerpt(body, 180, tag(item, "description")),
        longExcerpt: buildExcerpt(body, 320, tag(item, "description")),
        ...(cover ? { coverImage: cardSizedImage(cover) } : {}),
        readingMinutes: Math.max(1, Math.round(words / 200)),
      };
    })
    .filter((post): post is NewsletterPost => post !== null)
    // Newest first. The feed already arrives in this order, but the page leads
    // with "latest" and that claim should not depend on Substack's ordering.
    .sort((a, b) => b.date.localeCompare(a.date));
}
