-- A pending claim must not be able to burn somebody else's post.
--
-- 0023 moved uniqueness onto post_identity and kept 0003's partial condition,
-- status <> 'rejected', so a PENDING submission held a post exclusively. That is
-- the shape 0003 was written to remove at the URL level, and it came back with
-- the identity: whoever files first owns the post until a reviewer looks, and
-- the real author is refused in the meantime.
--
-- It is not symmetric across platforms, which is why it survived review twice.
-- X and TikTok put the author in the path, so submit_entry raises wrong_account
-- (P0209) and a thief cannot file somebody else's post at all. Instagram does
-- not, authorFromUrl returns null, and 0011 guards its check with
-- IF v_author <> '', so Instagram is the whole of the exposure. A creator who
-- sees a rival's reel can file it, hold it until review, and cost them the week.
--
-- The rule actually wanted is about credit, not about claims. Two people may
-- both claim a post; only one may ever be paid for it. Exclusivity moves to
-- approval and a pending row blocks nobody.
--
-- Submitting a post somebody is ALREADY credited for is still refused at submit
-- time, by an explicit check rather than by the index. Losing that answer would
-- have a creator paste a link, be told it went through, and find out at review
-- that it never counted, which is worse than the bug being fixed here.

-- ---------------------------------------------------------------------------
-- 1. The identity expression, in one place.
--
-- 0023 inlined it in a generated column, and this migration needs the same
-- expression in submit_entry. Two copies of a rule that must agree exactly is
-- how they stop agreeing, so it becomes a function and the column is rebuilt on
-- top of it. IMMUTABLE because a generated column will not accept anything less,
-- which is also why the enum is compared rather than cast: an enum to text cast
-- is only STABLE.

CREATE OR REPLACE FUNCTION post_identity_of(p_url text, p_platform platform)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_platform
    WHEN 'x' THEN
      'x:' || COALESCE(substring(lower(p_url) from 'status(?:es)?/([0-9]+)'), lower(p_url))
    WHEN 'tiktok' THEN
      'tiktok:' || COALESCE(substring(lower(p_url) from '/video/([0-9]+)'), lower(p_url))
    WHEN 'instagram' THEN
      'instagram:' || COALESCE(substring(p_url from '/(?:p|reel|reels|tv)/([A-Za-z0-9_-]+)'), lower(p_url))
    ELSE lower(p_url)
  END
$$;

-- ---------------------------------------------------------------------------
-- 2. The column, rebuilt on the function, and exclusivity moved to approval.
--
-- No collision cleanup is needed before the new index. The old index forbade
-- any two non-rejected rows sharing an identity, which is strictly stronger than
-- forbidding two approved ones, so no pair that would break the new index can
-- exist.

DROP INDEX IF EXISTS "submission_identity_unique_active";

ALTER TABLE "submissions" DROP COLUMN IF EXISTS "post_identity";

ALTER TABLE "submissions"
  ADD COLUMN "post_identity" text
  GENERATED ALWAYS AS (post_identity_of("url", "platform")) STORED;

CREATE UNIQUE INDEX "submission_identity_unique_approved"
  ON "submissions" ("post_identity")
  WHERE "status" = 'approved';

-- ---------------------------------------------------------------------------
-- 3. submit_entry, refusing a post already credited but allowing a contest.
--
-- Regenerated from 0024, its latest definition. The lineage guard fails if this
-- drops a rule 0024 raised.

CREATE OR REPLACE FUNCTION submit_entry(
  p_enrolment        uuid,
  p_challenge        uuid,
  p_platform         platform,
  p_url              text,
  p_allow_before_open boolean,
  p_author           text
)
RETURNS TABLE (submission_id uuid, entry_id uuid, is_first_for_entry boolean)
LANGUAGE plpgsql AS $$
DECLARE
  v_campaign   uuid;
  v_creator    uuid;
  v_entry      uuid;
  v_base       integer;
  v_bonus2     integer;
  v_bonus3     integer;
  v_created    boolean := false;
  v_author     text := lower(btrim(COALESCE(p_author, '')));
  ch           challenges%ROWTYPE;
BEGIN
  SELECT campaign_id, creator_id INTO v_campaign, v_creator
    FROM campaign_creators WHERE id = p_enrolment;
  IF v_campaign IS NULL THEN
    RAISE EXCEPTION 'unknown_creator' USING ERRCODE = 'P0201';
  END IF;

  -- Voided by an admin. Refused here rather than at review, because a
  -- disqualified creator who can still submit is being invited to keep working
  -- for nothing, and finds out days later.
  IF NOT enrolment_is_active(p_enrolment) THEN
    RAISE EXCEPTION 'enrolment_not_active' USING ERRCODE = 'P0212';
  END IF;

  /*
   * Already credited to somebody. Refused here, at submit, not left to review.
   *
   * The index below only constrains approved rows, so a pending insert never
   * collides and unique_violation cannot fire for this case any more. Without
   * this check a creator would paste a link, be told it went through, do the
   * rest of the week's work believing it counted, and find out at review. The
   * whole reason the old index was partial on status was to give that answer
   * early, and losing it would be a worse bug than the one 0025 fixes.
   *
   * A merely pending claim is deliberately NOT checked. That is the burn.
   */
  IF EXISTS (
    SELECT 1 FROM submissions s
     WHERE s.status = 'approved'
       AND s.post_identity = post_identity_of(p_url, p_platform)
  ) THEN
    RAISE EXCEPTION 'url_already_submitted' USING ERRCODE = 'P0208';
  END IF;

  SELECT * INTO ch FROM challenges WHERE id = p_challenge;
  IF ch.id IS NULL OR ch.campaign_id <> v_campaign THEN
    RAISE EXCEPTION 'unknown_challenge' USING ERRCODE = 'P0202';
  END IF;

  IF ch.status <> 'active' THEN
    RAISE EXCEPTION 'challenge_closed' USING ERRCODE = 'P0203';
  END IF;

  IF now() < ch.starts_at AND NOT COALESCE(p_allow_before_open, false) THEN
    RAISE EXCEPTION 'challenge_not_open' USING ERRCODE = 'P0204';
  END IF;

  IF now() > ch.ends_at THEN
    RAISE EXCEPTION 'challenge_ended' USING ERRCODE = 'P0205';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM creator_social_handles
     WHERE creator_id = v_creator AND platform = p_platform
  ) THEN
    RAISE EXCEPTION 'platform_not_registered' USING ERRCODE = 'P0206';
  END IF;

  -- Where the platform puts the author in the link, it has to be their account.
  IF v_author <> '' AND NOT EXISTS (
    SELECT 1 FROM creator_social_handles
     WHERE creator_id = v_creator
       AND platform = p_platform
       AND lower(handle_normalized) = v_author
  ) THEN
    RAISE EXCEPTION 'wrong_account' USING ERRCODE = 'P0209';
  END IF;

  PERFORM 1 FROM campaign_creators WHERE id = p_enrolment FOR UPDATE;

  SELECT id INTO v_entry FROM challenge_entries
   WHERE campaign_creator_id = p_enrolment AND challenge_id = p_challenge;

  IF v_entry IS NULL THEN
    SELECT
      COALESCE(max(CASE WHEN key = 'entry_base' THEN default_points END), ch.base_points),
      COALESCE(max(CASE WHEN key = 'multi_platform_bonus_2' THEN default_points END), 0),
      COALESCE(max(CASE WHEN key = 'multi_platform_bonus_3' THEN default_points END), 0)
      INTO v_base, v_bonus2, v_bonus3
      FROM point_rules WHERE campaign_id = v_campaign;

    INSERT INTO challenge_entries (
      campaign_creator_id, challenge_id,
      base_points_snapshot, bonus_2_snapshot, bonus_3_snapshot
    ) VALUES (
      p_enrolment, p_challenge, v_base, v_bonus2, v_bonus3
    ) RETURNING id INTO v_entry;

    v_created := true;
  END IF;

  BEGIN
    INSERT INTO submissions (entry_id, platform, url)
    VALUES (v_entry, p_platform, p_url)
    RETURNING id INTO submission_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- Matched to the index that actually fired. Both candidates are
      -- partial on status <> 'rejected', so a rejected row is not a
      -- collision and must not be reported as one.
      IF EXISTS (
        SELECT 1 FROM submissions s
         WHERE s.entry_id = v_entry
           AND s.platform = p_platform
           AND s.status <> 'rejected'
      ) THEN
        RAISE EXCEPTION 'already_submitted_for_platform' USING ERRCODE = 'P0207';
      END IF;
      RAISE EXCEPTION 'url_already_submitted' USING ERRCODE = 'P0208';
  END;

  entry_id := v_entry;
  is_first_for_entry := v_created;
  RETURN NEXT;
END $$;

-- ---------------------------------------------------------------------------
-- 4. review(), refusing to pay twice for one post.

CREATE OR REPLACE FUNCTION review(
  p_sub    uuid,
  p_status submission_status,
  p_admin  uuid,
  p_note   text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_entry    uuid;
  v_platform platform;
  v_verified timestamptz;
  v_active   boolean;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'reviewer_required' USING ERRCODE = 'P0103';
  END IF;

  IF p_status = 'approved' THEN
    SELECT s.platform, csh.verified_at, COALESCE(cc.status, 'active') = 'active'
      INTO v_platform, v_verified, v_active
      FROM submissions s
      JOIN challenge_entries ce  ON ce.id = s.entry_id
      JOIN campaign_creators cc  ON cc.id = ce.campaign_creator_id
      LEFT JOIN creator_social_handles csh
        ON csh.creator_id = cc.creator_id AND csh.platform = s.platform
     WHERE s.id = p_sub;

    IF v_platform IS NULL THEN
      RAISE EXCEPTION 'submission_not_found' USING ERRCODE = 'P0002';
    END IF;

    -- Before the handle check, because "this creator is disqualified" is the
    -- more useful sentence when both are true.
    IF NOT v_active THEN
      RAISE EXCEPTION 'enrolment_not_active' USING ERRCODE = 'P0212';
    END IF;

    IF v_verified IS NULL THEN
      RAISE EXCEPTION 'handle_not_verified' USING ERRCODE = 'P0211';
    END IF;

    /*
     * Somebody else is already credited for this post.
     *
     * Checked by name rather than left to the unique index, because the index
     * raises unique_violation and the handler below maps that to
     * superseded_by_newer_submission, which is a different situation and the
     * wrong sentence to put in front of a reviewer.
     */
    IF EXISTS (
      SELECT 1
        FROM submissions other
        JOIN submissions mine ON mine.id = p_sub
       WHERE other.id <> p_sub
         AND other.status = 'approved'
         AND other.post_identity = mine.post_identity
    ) THEN
      RAISE EXCEPTION 'post_already_credited' USING ERRCODE = 'P0213';
    END IF;
  END IF;

  BEGIN
    UPDATE submissions
       SET status = p_status,
           reviewed_at = now(),
           reviewed_by_admin_id = p_admin,
           review_note = COALESCE(p_note, review_note)
     WHERE id = p_sub
     RETURNING entry_id INTO v_entry;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'superseded_by_newer_submission' USING ERRCODE = 'P0210';
  END;

  IF v_entry IS NULL THEN
    RAISE EXCEPTION 'submission_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM recompute_entry_award(v_entry);
END $$;
