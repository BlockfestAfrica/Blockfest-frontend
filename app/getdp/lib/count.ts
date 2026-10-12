/**
 * Counting the DPs made: the one request Get DP sends.
 *
 * When a person first downloads, shares or saves a picture, the page tells
 * the site which role it says and how it left the page, and nothing else: no
 * name, no photograph, no identifier. The admin overview counts these
 * (app/api/getdp/generated, lib/admin/metrics.ts).
 *
 * This is the only file in app/getdp that sends anything, and
 * __tests__/unit/privacy.test.ts holds it to that and to what it sends.
 */
import type { DPRole } from "./dp";

/**
 * How a DP left the page: the save and share buttons (share, more, photos,
 * download, save), each app's mark, and WhatsApp Status. The database's
 * CHECK in netlify/database/migrations/0072_dp_generations.sql lists the same.
 */
export const DP_CHANNELS = [
  "download",
  "share",
  "more",
  "photos",
  "save",
  "status",
  "x",
  "instagram",
  "tiktok",
  "linkedin",
  "whatsapp",
] as const;

export type DPChannel = (typeof DP_CHANNELS)[number];

export const COUNT_URL = "/api/getdp/generated";

/**
 * Tells the site one DP was made. Never waits and never fails the page: a
 * count that does not arrive is a count lost, not an error anybody sees.
 * keepalive lets it finish when the tap leaves the page (a mark's link).
 */
export function countDp(role: DPRole, channel: DPChannel): void {
  try {
    void fetch(COUNT_URL, {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, channel }),
    }).catch(() => undefined);
  } catch {
    // A browser without fetch, or one that refuses: the DP is what matters.
  }
}
