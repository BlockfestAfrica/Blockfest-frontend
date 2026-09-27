import { PLATFORM_ICON } from "@/components/shared/platform-icon";
import { platformLabels, type CampaignPlatform } from "@/lib/campaigns";

/**
 * Platform marks: the ballot's chip language, for every place a post or an
 * account is shown as a mark rather than as a word or a URL.
 *
 * Extracted on the second reuse. The ballot drew these inline; the creator
 * page and the weekly winners now draw the same chip, and three private
 * copies of one 36px circle drift the way the old inputClass did.
 *
 * A mark is a link when there is a post behind it (solid hairline, ink-2,
 * the ballot's hover), and a still mark when there is not (dashed when the
 * slot is empty, solid when it only names an account). The 44px box around
 * the 36px chip is the tap target.
 */

/** One order everywhere marks are listed, phones included, so X sits
    first in the ballot, the winners and the creator page alike. */
export const PLATFORM_ORDER = ["x", "instagram", "tiktok"] as const;

/* From sm up each platform keeps its own cell on one line of a
   `sm:grid-cols-[repeat(3,2.75rem)]` list, so X lines up under X down a
   list even when somebody has no Instagram. The row is pinned as well as
   the column: with only a column, a link arriving out of order would be
   placed on a second line. */
export const MARK_SLOT: Record<string, string> = {
  x: "sm:col-start-1 sm:row-start-1",
  instagram: "sm:col-start-2 sm:row-start-1",
  tiktok: "sm:col-start-3 sm:row-start-1",
};

/** The platform's name, or the raw token for one the registry lacks. */
export const platformLabel = (platform: string) =>
  platformLabels[platform as CampaignPlatform] ?? platform;

const rank = (platform: string) => {
  const i = (PLATFORM_ORDER as readonly string[]).indexOf(platform);
  return i === -1 ? PLATFORM_ORDER.length : i;
};

/** A copy of the list in PLATFORM_ORDER; unknown platforms keep their order, last. */
export function byPlatform<T>(items: readonly T[], platformOf: (item: T) => string): T[] {
  return [...items].sort((a, b) => rank(platformOf(a)) - rank(platformOf(b)));
}

function Glyph({ platform }: { platform: string }) {
  const Icon = PLATFORM_ICON[platform as CampaignPlatform];
  return Icon ? (
    <Icon className="h-4 w-4" aria-hidden="true" />
  ) : (
    <span className="text-xs font-semibold" aria-hidden="true">
      {platformLabel(platform)}
    </span>
  );
}

export function MarkLink({
  platform,
  url,
  label,
}: {
  platform: string;
  url: string;
  /** Whose post and where, said in full: the chip has no words. */
  label: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label={`${label} (opens in a new tab)`}
      title={`Open on ${platformLabel(platform)}`}
      className="group inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:text-white"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line-2 transition-colors duration-150 group-hover:border-line-3 group-hover:bg-card-3">
        <Glyph platform={platform} />
      </span>
    </a>
  );
}

export function MarkStill({
  platform,
  empty = false,
}: {
  platform: string;
  /** Nothing sent or nothing registered: a dashed, fainter ring. */
  empty?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center"
    >
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${
          empty ? "border-dashed border-line-2 text-ink-4" : "border-line-2 text-ink-3"
        }`}
      >
        <Glyph platform={platform} />
      </span>
    </span>
  );
}
