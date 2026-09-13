-- Approval no longer requires a verified handle.
--
-- The campaign team ruled the verification step out: asking every creator to
-- publish a BF- code on each account before their work can score is a hurdle
-- at exactly the moment the campaign wants people posting, and explaining it
-- was costing more than it protected. The decision is theirs to make, because
-- what the check bought was insurance, and insurance has a premium.
--
-- What it bought, recorded here so the trade is legible later: a handle typed
-- at registration is a claim, not a fact. On X and TikTok the URL carries the
-- author, so submit_entry proves a post belongs to the REGISTERED handle, but
-- nothing proves the registered handle belongs to the REGISTRANT. Somebody who
-- registers another creator's handle and submits that creator's real posts
-- passes every automatic check this system has. The code-in-bio step was the
-- proof of control that closed that, and review() refusing to approve through
-- an unverified handle (P0211, added in 0022) was its enforcement.
--
-- With it gone, the defence is the reviewer: the queue shows the registered
-- handle beside every link, and approving is vouching that the work and the
-- account line up. The columns stay. verified_at and verification_code cost
-- nothing, void_enrolment still clears verified_at harmlessly, and if week one
-- brings the impersonation the check existed for, re-enforcing is one
-- migration that restores the RAISE rather than a rebuild.
--
-- review() is regenerated from 0028, its latest definition, minus the check.
-- The lineage guard knows 'handle_not_verified' was dropped deliberately; it
-- is recorded in DELIBERATELY_DROPPED with this reasoning.

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
  v_active   boolean;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'reviewer_required' USING ERRCODE = 'P0103';
  END IF;

  IF p_status = 'approved' THEN
    /*
     * FOR UPDATE OF cc, so the status read cannot race void_enrolment.
     *
     * Without the lock there is a window: the reviewer's approval reads
     * status = 'active', an admin's void commits, and the approval then pays
     * points to a creator who was disqualified a moment before, including the
     * referral their first approval triggers. OF cc, because it is only the
     * enrolment row whose stability matters here.
     */
    SELECT s.platform, COALESCE(cc.status, 'active') = 'active'
      INTO v_platform, v_active
      FROM submissions s
      JOIN challenge_entries ce  ON ce.id = s.entry_id
      JOIN campaign_creators cc  ON cc.id = ce.campaign_creator_id
     WHERE s.id = p_sub
       FOR UPDATE OF cc;

    IF v_platform IS NULL THEN
      RAISE EXCEPTION 'submission_not_found' USING ERRCODE = 'P0002';
    END IF;

    -- Before the handle check, because "this creator is disqualified" is the
    -- more useful sentence when both are true.
    IF NOT v_active THEN
      RAISE EXCEPTION 'enrolment_not_active' USING ERRCODE = 'P0212';
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
