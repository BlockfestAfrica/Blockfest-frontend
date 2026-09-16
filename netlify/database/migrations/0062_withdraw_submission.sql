/*
 * A creator can take back a submission nobody has reviewed yet.
 *
 * Every submission already mails the creator a receipt naming the platform
 * and echoing the URL, and that receipt tells them: "If that link is not
 * the post you meant, submit the right one before the week closes." They
 * could not. The partial unique index on (entry_id, platform) refuses a
 * second submission while the first is pending, so the only route was
 * writing to support and waiting for an admin to reject it. The product
 * was advising an action the product forbade.
 *
 * That matters most for the case this was built for: somebody else got
 * hold of a personal link and submitted on the creator's behalf. The
 * engine already blocks the worst of that, since submit_entry demands the
 * post come from the registered handle, and a human reviews everything
 * before points. What was missing was the creator's own ability to undo
 * it in the ten seconds after the receipt arrives.
 *
 * DELETE rather than a new status. submission_status is an enum, and
 * Postgres refuses to use a value added in the same migration that adds
 * it, so a 'withdrawn' member would need two deploys. It would also be a
 * lie in the one place a creator reads their own history: withdrawn is
 * not rejected, and rendering it as "needs a change" would tell them a
 * reviewer judged something nobody looked at. The row goes, and the audit
 * row keeps the trace, carrying the url and platform so a dispute has
 * something to read.
 *
 * Scoped to the enrolment in the WHERE clause, not by a check the caller
 * could forget: a creator can only withdraw their own, and passing
 * somebody else's id finds no row.
 */

CREATE OR REPLACE FUNCTION withdraw_submission(
  p_enrolment  uuid,
  p_submission uuid
)
RETURNS TABLE (platform text, url text)
LANGUAGE plpgsql AS $$
DECLARE
  s          record;
  v_campaign uuid;
BEGIN
  IF p_enrolment IS NULL THEN
    RAISE EXCEPTION 'creator_required' USING ERRCODE = 'P0103';
  END IF;

  SELECT sub.id, sub.platform, sub.url, sub.status, ce.campaign_creator_id
    INTO s
    FROM submissions sub
    JOIN challenge_entries ce ON ce.id = sub.entry_id
   WHERE sub.id = p_submission
     AND ce.campaign_creator_id = p_enrolment
   FOR UPDATE OF sub;

  IF s.id IS NULL THEN
    -- Not theirs, or not there. One name for both, because telling a
    -- caller which of the two would answer "does this submission exist"
    -- for any id they care to type.
    RAISE EXCEPTION 'submission_not_found' USING ERRCODE = 'P0002';
  END IF;

  /*
   * Only while nobody has ruled on it. An approved submission is a
   * scoring decision with points already minted against it, and a
   * rejected one is a reviewer's recorded judgement; neither is a
   * creator's to erase.
   */
  IF s.status <> 'pending' THEN
    RAISE EXCEPTION 'already_reviewed' USING ERRCODE = 'P0912';
  END IF;

  SELECT cc.campaign_id INTO v_campaign
    FROM campaign_creators cc WHERE cc.id = p_enrolment;

  DELETE FROM submissions WHERE id = s.id;

  /*
   * No actor_admin_id: nobody on the team did this. The same shape the
   * self-service link recovery uses, and the note says which of the two
   * reasons brought them here, because "this was not me" is a security
   * event and "wrong link" is a typo.
   */
  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, before, note
  ) VALUES (
    v_campaign, NULL, 'submission.withdrawn', 'submission', s.id,
    jsonb_build_object(
      'platform', s.platform::text,
      'url', s.url,
      'campaign_creator_id', p_enrolment
    ),
    'Withdrawn by the creator before review.'
  );

  platform := s.platform::text;
  url := s.url;
  RETURN NEXT;
END $$;
