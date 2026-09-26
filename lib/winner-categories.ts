/**
 * The two weekly prizes, named once.
 *
 * The winners page and the leaderboard both label them, and the leaderboard's
 * table runs in the browser, so the labels live here rather than in
 * lib/winners.ts, which is server-only.
 */

export type WinnerCategory = "creator_of_week" | "community_favourite";

export const WINNER_CATEGORY_LABEL: Record<WinnerCategory, string> = {
  creator_of_week: "Creator of the Week",
  community_favourite: "Community Favourite",
};

export function isWinnerCategory(value: unknown): value is WinnerCategory {
  return value === "creator_of_week" || value === "community_favourite";
}
