/*
 * Self-service link recovery. Closes #206, successor to #78.
 *
 * #78 stopped a link from signing anybody in on the GET that resolved it: a
 * token is parked in a pending cookie and only a deliberate POST turns it
 * into a session. That left one gap named in its own follow-up: a creator
 * who deleted the registration email, or never received it, had no way back
 * in except writing to support and waiting on an admin to run the reissue
 * tool in app/api/admin/creator-link/route.ts.
 *
 * These columns hold a SECOND, short-lived token, entirely separate from
 * access_token_hash. Requesting recovery mints one of these and emails a
 * confirmation link; the existing access link keeps working, unchanged,
 * until that confirmation link is actually clicked and confirmed. Only the
 * confirmation step rotates access_token_hash, the same way the admin tool
 * does. Two tokens rather than reusing access_token_hash for the pending
 * value is what keeps "requesting alone changes nothing" true: nothing here
 * can invalidate the working link before a human proves inbox access.
 *
 * Hashed at rest for the same reason access_token_hash is: the database
 * alone must not be enough to act as somebody. Short-lived, because unlike
 * the access link this one is never meant to be kept.
 */

ALTER TABLE campaign_creators
  ADD COLUMN IF NOT EXISTS recovery_token_hash text,
  ADD COLUMN IF NOT EXISTS recovery_token_expires_at timestamptz;

-- Partial: most rows have no pending recovery, so a full index would carry
-- entries that are never queried by. The confirm step looks up by hash
-- alone, the same shape as the access-token lookup it mirrors.
CREATE INDEX IF NOT EXISTS campaign_creators_recovery_token_idx
  ON campaign_creators (recovery_token_hash)
  WHERE recovery_token_hash IS NOT NULL;
