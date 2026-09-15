/*
 * A swept round stops accepting votes.
 *
 * The audit found the redemption window outliving the sweep. verify_vote
 * tested only the clock (closes_at plus fifteen minutes) and never the
 * round's own state, so a farm could cast late, not verify, wait for the
 * admin to close the round early, watch the cluster screen come up clean
 * because nothing was verified yet, and then redeem every held code after
 * reviewed_at was set. The tally moves after the human certified it, and
 * publish_weekly_winner's P0805 gate opens on a number nobody reviewed.
 *
 * Two halves, because either alone leaves the hole:
 *
 *   verify_vote refuses once the round is reviewed or published. The clock
 *   test stays: an unreviewed round still closes on time.
 *
 *   mark_round_reviewed refuses while codes are still redeemable, which is
 *   until closes_at plus the same fifteen minutes verify_vote honours. An
 *   admin who closes a round early must wait out the grace before
 *   certifying it, which is exactly the window the attack needed. P0821
 *   codes_still_live, so the console can say why rather than showing a
 *   generic failure.
 *
 * Both bodies are 0048's exactly plus the new guards; every raise is kept
 * and the lineage guard checks that mechanically.
 */

CREATE OR REPLACE FUNCTION verify_vote(
  p_campaign_slug   text,
  p_round           uuid,
  p_email_canonical text,
  p_code_hash       text,
  p_domain_cap      integer,
  p_domain_allowlisted boolean
)
RETURNS TABLE (vote_id uuid, held boolean)
LANGUAGE plpgsql AS $$
DECLARE
  r       vote_rounds%ROWTYPE;
  v_camp  uuid;
  v       votes%ROWTYPE;
  v_domain text;
  v_used  integer;
BEGIN
  SELECT id INTO v_camp FROM campaigns WHERE slug = p_campaign_slug;
  SELECT * INTO r FROM vote_rounds WHERE id = p_round AND campaign_id = v_camp;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'unknown_round' USING ERRCODE = 'P0813';
  END IF;
  IF now() > r.closes_at + interval '15 minutes' THEN
    RAISE EXCEPTION 'round_not_open' USING ERRCODE = 'P0814';
  END IF;
  /*
   * And the state, not only the clock. A reviewed round has been certified
   * by a human; a published one has paid. Neither may gain a vote, however
   * live the code in somebody's inbox still looks.
   */
  IF r.reviewed_at IS NOT NULL OR r.status = 'published' THEN
    RAISE EXCEPTION 'round_not_open' USING ERRCODE = 'P0814';
  END IF;

  SELECT * INTO v FROM votes
   WHERE round_id = p_round AND voter_email_canonical = p_email_canonical
     AND status = 'counted' AND verified_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'code_invalid' USING ERRCODE = 'P0817';
  END IF;
  IF v.code_hash IS DISTINCT FROM p_code_hash OR now() > v.code_expires_at THEN
    RAISE EXCEPTION 'code_invalid' USING ERRCODE = 'P0817';
  END IF;

  -- The cap. Counted votes from this domain in this round, allowlisted
  -- consumer providers exempt. Held is not a refusal: the vote is real,
  -- verified, and waits for the human the threat model always ends at.
  held := false;
  IF NOT COALESCE(p_domain_allowlisted, false) THEN
    v_domain := split_part(p_email_canonical, '@', 2);
    SELECT count(*) INTO v_used
      FROM votes v2
     WHERE v2.round_id = p_round
       AND v2.status = 'counted'
       AND v2.verified_at IS NOT NULL
       AND v2.held_at IS NULL
       AND split_part(v2.voter_email_canonical, '@', 2) = v_domain;
    IF v_used >= COALESCE(p_domain_cap, 10) THEN
      held := true;
    END IF;
  END IF;

  UPDATE votes
     SET verified_at = now(),
         held_at = CASE WHEN held THEN now() ELSE NULL END,
         code_hash = NULL,
         code_expires_at = NULL
   WHERE id = v.id;

  vote_id := v.id;
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION mark_round_reviewed(p_admin uuid, p_round uuid)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  r vote_rounds%ROWTYPE;
BEGIN
  IF p_admin IS NULL THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = 'P0401';
  END IF;
  SELECT * INTO r FROM vote_rounds WHERE id = p_round FOR UPDATE;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'unknown_round' USING ERRCODE = 'P0813';
  END IF;
  IF r.status <> 'closed' THEN
    RAISE EXCEPTION 'round_not_closed' USING ERRCODE = 'P0820';
  END IF;
  /*
   * Certifying a sweep means the board the admin saw is the final board.
   * While an outstanding code can still be redeemed, it is not: closing a
   * round early and marking it reviewed inside the grace was the exact
   * sequence that let a farm's held codes land after the review.
   */
  IF now() <= r.closes_at + interval '15 minutes' THEN
    RAISE EXCEPTION 'codes_still_live' USING ERRCODE = 'P0821';
  END IF;
  UPDATE vote_rounds
     SET reviewed_at = now(), reviewed_by_admin_id = p_admin
   WHERE id = p_round;
  INSERT INTO audit_log (campaign_id, actor_admin_id, action, entity_type, entity_id)
  VALUES (r.campaign_id, p_admin, 'vote_round.reviewed', 'vote_round', p_round);
END $$;
