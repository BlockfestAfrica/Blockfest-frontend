-- One post, one entry, however the link is spelled.
--
-- canonicalUrl stripped the query, the fragment and a trailing slash, and the
-- uniqueness index then compared the resulting string. A string is not a post.
-- Every one of these is the same post and every one produced a different
-- string, so each could be entered again for full points, week after week:
--
--   https://x.com/ada/status/123          https://twitter.com/ada/status/123
--   https://mobile.x.com/ada/status/123   https://x.com/Ada/status/123
--   https://x.com/ada/statuses/123        https://x.com/ada/status/123/photo/1
--   https://x.com//ada/status/123         https://x.com/ada/status/%31%32%33
--   https://instagram.com/p/ABC/          https://instagr.am/p/ABC/
--   https://instagram.com/reel/ABC/       https://instagram.com/ada/p/ABC/
--
-- The rule the campaign actually has is about posts, so the column stores the
-- post: the platform and the id the platform itself uses. Uniqueness moves onto
-- that and off the spelling.
--
-- Computed by the database rather than by the route, deliberately. A generated
-- column cannot be bypassed by a caller that forgets it, cannot drift from a
-- second copy of the rule in TypeScript, and needs no change to submit_entry,
-- whose signature four migrations have already rewritten. The existing
-- unique_violation handler in 0019 catches this index and already reports
-- url_already_submitted (P0208), so the creator facing message is unchanged.

-- ---------------------------------------------------------------------------
-- 1. The identity.
--
-- The fallback when no id can be found is the lowercased URL, not a constant.
-- A constant would collapse every unextractable link onto one value and the
-- first creator to post a vm.tiktok.com short link would block all the others.
-- Falling back to the URL leaves those exactly as they are today, which is the
-- current behaviour and no worse.
--
-- Instagram shortcodes are case sensitive and are deliberately not lowercased.
-- X and TikTok ids are digits, where case does not arise.

ALTER TABLE "submissions"
  ADD COLUMN "post_identity" text
  GENERATED ALWAYS AS (
    -- Compared as the enum, never cast to text. An enum to text cast is STABLE
    -- rather than IMMUTABLE, because a label can be renamed, and Postgres
    -- refuses a generated column built on anything but an immutable expression.
    CASE "platform"
      WHEN 'x' THEN
        'x:' || COALESCE(
          substring(lower("url") from 'status(?:es)?/([0-9]+)'),
          lower("url")
        )
      WHEN 'tiktok' THEN
        'tiktok:' || COALESCE(
          substring(lower("url") from '/video/([0-9]+)'),
          lower("url")
        )
      WHEN 'instagram' THEN
        'instagram:' || COALESCE(
          substring("url" from '/(?:p|reel|reels|tv)/([A-Za-z0-9_-]+)'),
          lower("url")
        )
      ELSE lower("url")
    END
  ) STORED;

-- ---------------------------------------------------------------------------
-- 2. Anything already stored that the new rule would have refused.
--
-- Creating a unique index over rows that already collide fails, and a failed
-- migration blocks the deploy. So the collisions are resolved first, by the
-- same rule the index is about to enforce: the earliest claim on a post keeps
-- it, later ones are rejected rather than deleted.
--
-- Rejection is the right disposal and not merely the safe one. The ledger is
-- append-only and 0003 made the index partial on status <> 'rejected', so a
-- rejected row keeps its history, releases its claim, and lets the creator
-- submit something else. Deleting would erase the evidence of what happened.

WITH ranked AS (
  SELECT
    s.id,
    row_number() OVER (
      PARTITION BY
        CASE s."platform"::text
          WHEN 'x' THEN 'x:' || COALESCE(substring(lower(s."url") from 'status(?:es)?/([0-9]+)'), lower(s."url"))
          WHEN 'tiktok' THEN 'tiktok:' || COALESCE(substring(lower(s."url") from '/video/([0-9]+)'), lower(s."url"))
          WHEN 'instagram' THEN 'instagram:' || COALESCE(substring(s."url" from '/(?:p|reel|reels|tv)/([A-Za-z0-9_-]+)'), lower(s."url"))
          ELSE lower(s."url")
        END
      ORDER BY s."created_at", s."id"
    ) AS seat
  FROM "submissions" s
  WHERE s."status" <> 'rejected'
)
UPDATE "submissions" s
   SET "status" = 'rejected',
       -- submission_reviewed_consistently, from 0000, refuses any non-pending
       -- row with a null reviewed_at. It does not require a reviewer, and one
       -- is deliberately not invented here: no person made this call, and
       -- writing an admin's name against a decision they did not take is how an
       -- audit trail stops being worth reading.
       "reviewed_at" = now(),
       "review_note" = COALESCE(NULLIF(btrim(s."review_note"), '') || ' ', '')
         || 'Rejected automatically: this post was already entered under an earlier submission.'
  FROM ranked r
 WHERE r.id = s.id
   AND r.seat > 1;

-- ---------------------------------------------------------------------------
-- 3. Uniqueness moves onto the post.
--
-- The old index is dropped rather than kept alongside. Identity subsumes it:
-- the same URL always yields the same identity, so every collision the URL
-- index caught this one catches too, and keeping both would mean two
-- constraints raising the same error for one cause.

DROP INDEX IF EXISTS "submission_url_unique_active";

CREATE UNIQUE INDEX "submission_identity_unique_active"
  ON "submissions" ("post_identity")
  WHERE "status" <> 'rejected';
