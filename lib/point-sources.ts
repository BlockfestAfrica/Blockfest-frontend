/**
 * What a ledger source is called when a creator reads it.
 *
 * The enum values are written for the engine: challenge_entry, featured_monica,
 * manual_adjustment. A creator opening their own page should not have to
 * translate them, and "manual_adjustment" in particular reads as something
 * having gone wrong when it is usually a correction somebody explained in the
 * note beside it.
 *
 * Not in the database, because these are words on a page rather than data, and
 * changing one should not need a migration.
 */
export const POINT_SOURCE_LABELS: Record<string, string> = {
  challenge_entry: "Entry approved",
  quality_bonus: "Quality bonus",
  engagement_milestone: "Audience milestone",
  featured_blockfest: "Featured by Blockfest Africa",
  featured_monica: "Featured by Monica",
  collab: "Collaboration",
  wildcard_win: "Wildcard win",
  referral: "Referral",
  manual_adjustment: "Adjustment",
};

/**
 * Falls back to the raw value rather than to something reassuring.
 *
 * A source nobody has labelled is a source nobody has thought about, and
 * showing it plainly is how that gets noticed. Dressing it up as "Bonus" would
 * hide the gap and could be wrong about the sign.
 */
export function pointSourceLabel(source: string): string {
  return POINT_SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}
