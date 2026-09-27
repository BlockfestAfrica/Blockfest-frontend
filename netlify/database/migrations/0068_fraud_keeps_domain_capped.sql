/*
 * A swept farm stays capped.
 *
 * On the first Sunday of the Community Favourite vote a catch-all domain
 * (no website, every address routed to one inbox) verified eleven votes
 * from random ten-letter addresses in fourteen minutes. The domain cap did
 * its job: ten counted and the eleventh was held. But the cap counted only
 * votes still counted, so removing the farm as fraud dropped the domain
 * back to zero, and the same person could land another ten counted votes
 * with fresh addresses, and again after every sweep, until the close.
 *
 * verify_vote now counts fraud removals toward the domain's cap. Once an
 * owner has removed a domain's votes as fraud, every later vote from it is
 * held for a person to look at, with nothing different in what the voter
 * sees. Unsweep removals do not count: those are people freed to vote
 * again, not a judgement on their domain.
 *
 * The body is 0058's exactly apart from the cap's WHERE clause; every raise
 * is kept, which the lineage guard checks mechanically.
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
  --
  -- Votes an owner removed as fraud stay in the count. They used to fall
  -- out of it, so sweeping a farm reset its domain to zero and the same
  -- catch-all could land another full cap of counted votes the next
  -- minute. An unsweep is a person freed to vote again, not a judgement on
  -- the domain, so it does not count.
  held := false;
  IF NOT COALESCE(p_domain_allowlisted, false) THEN
    v_domain := split_part(p_email_canonical, '@', 2);
    SELECT count(*) INTO v_used
      FROM votes v2
     WHERE v2.round_id = p_round
       AND split_part(v2.voter_email_canonical, '@', 2) = v_domain
       AND (
             (v2.status = 'counted'
              AND v2.verified_at IS NOT NULL
              AND v2.held_at IS NULL)
          OR (v2.status = 'removed' AND v2.removed_mode = 'fraud')
           );
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
