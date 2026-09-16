/*
 * A creator can add a platform they did not register.
 *
 * Registration takes all three handles and every one of them is optional, so
 * somebody who only had X on the day typed X and nothing else. The ladder
 * pays more for the same piece posted on two or three platforms, and the
 * campaign wants the reach, but nothing let them come back and say "I am on
 * Instagram too".
 *
 * What they hit instead: submit_entry raises platform_not_registered (P0206)
 * with no handle row for that platform, and request_handle_change raises
 * handle_not_found (P0901) because there is nothing to change. Two refusals
 * that are each correct on their own and together describe a dead end, in
 * the one direction the campaign most wants people to move.
 *
 * Adding, never replacing. A handle already on file for that platform is the
 * change flow's business, and that flow exists precisely because swapping a
 * handle mid-campaign can reassign authorship of work already submitted.
 * Keeping them separate means this path can be immediate while that one stays
 * reviewed.
 *
 * Immediate is safe here for a reason worth stating. The handle lands
 * unverified, exactly as a registration handle does, so this adds no trust a
 * registration would not have created. Submitting still has to clear
 * wrong_account: on X and TikTok the link carries the author, so a handle the
 * creator does not control cannot be used to claim somebody else's post. And
 * every entry is reviewed by a person before it scores.
 *
 * One owner per handle, the same rule 0061 applies to the change paths. It
 * would be strange for the change flow to refuse a handle another active
 * creator holds while this one handed it over.
 */

CREATE OR REPLACE FUNCTION add_social_handle(
  p_enrolment uuid,
  p_platform  platform,
  p_handle    text
)
RETURNS TABLE (handle_id uuid, handle text)
LANGUAGE plpgsql AS $$
DECLARE
  v_creator uuid;
  v_handle  text := lower(btrim(COALESCE(p_handle, '')));
  v_id      uuid;
  v_campaign uuid;
BEGIN
  IF p_enrolment IS NULL THEN
    RAISE EXCEPTION 'creator_required' USING ERRCODE = 'P0103';
  END IF;

  -- Leading @ is what people type, and refusing it teaches nothing.
  v_handle := ltrim(v_handle, '@');

  IF v_handle !~ '^[a-z0-9._]{1,40}$' THEN
    RAISE EXCEPTION 'handle_invalid' USING ERRCODE = 'P0903';
  END IF;

  SELECT cc.creator_id, cc.campaign_id INTO v_creator, v_campaign
    FROM campaign_creators cc WHERE cc.id = p_enrolment;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'unknown_creator' USING ERRCODE = 'P0201';
  END IF;

  /*
   * A disqualified creator does not gain a new way to submit. The same
   * guard the change flow takes, and for the same reason.
   */
  IF NOT enrolment_is_active(p_enrolment) THEN
    RAISE EXCEPTION 'enrolment_not_active' USING ERRCODE = 'P0212';
  END IF;

  /*
   * Locked before the existence check, so two tabs adding the same platform
   * cannot both find nothing and both insert. The partial unique index on
   * (creator_id, platform) would catch the second, but as a constraint
   * violation rather than the sentence this raises.
   */
  PERFORM 1 FROM campaign_creators WHERE id = p_enrolment FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM creator_social_handles
     WHERE creator_id = v_creator AND platform = p_platform
  ) THEN
    RAISE EXCEPTION 'handle_already_set' USING ERRCODE = 'P0917';
  END IF;

  /*
   * One owner per handle, matching 0061. Only against creators who are still
   * in the campaign: a disqualified account should not hold a name hostage.
   */
  IF EXISTS (
    SELECT 1
      FROM creator_social_handles h
      JOIN campaign_creators occ ON occ.creator_id = h.creator_id
     WHERE h.platform = p_platform
       AND lower(h.handle_normalized) = v_handle
       AND h.creator_id <> v_creator
       AND COALESCE(occ.status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'handle_taken' USING ERRCODE = 'P0911';
  END IF;

  INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized)
  VALUES (v_creator, p_platform, v_handle, v_handle)
  RETURNING id INTO v_id;

  /*
   * No actor_admin_id: the creator did this themselves, the same shape the
   * withdrawal and the link recovery use.
   */
  INSERT INTO audit_log (
    campaign_id, actor_admin_id, action, entity_type, entity_id, after, note
  ) VALUES (
    v_campaign, NULL, 'handle.added', 'creator_social_handle', v_id,
    jsonb_build_object(
      'platform', p_platform::text,
      'handle', v_handle,
      'campaign_creator_id', p_enrolment
    ),
    'Creator added a platform they did not register with.'
  );

  handle_id := v_id;
  handle := v_handle;
  RETURN NEXT;
END $$;
