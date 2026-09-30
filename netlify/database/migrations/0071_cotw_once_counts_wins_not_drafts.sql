/*
 * Creator of the Week, once per campaign: counted on wins, not on drafts.
 *
 * The rule is published (rules v1.4, the FAQ and the prize card) and stays
 * exactly as it is. What changes is what counts as having won it.
 *
 * creator_of_week_once_per_campaign was a unique index over every
 * creator_of_week row, and weekly_winners holds drafts and announcements in
 * one table. So a draft saved for one week and never announced or discarded
 * held its creator for the rest of the campaign: choosing them in a later
 * week was refused with P0801, "That creator has already been Creator of the
 * Week", about somebody who had won nothing. The candidate list stopped
 * counting drafts in 0063, so the console offered the name and the database
 * then refused it with a sentence that was not true.
 *
 * 1. The index now covers announced rows only. It is still what stops two
 *    announcements of one creator landing together.
 *
 * 2. A trigger keeps the other half of what the old index did: a creator who
 *    has actually won cannot be saved again, as a draft or an announcement,
 *    in any other week. It raises the same P0801, which publish_weekly_winner
 *    lets through untouched (it only rewrites unique_violation), so the admin
 *    sees the same message and nothing is written. publish_weekly_winner
 *    itself is not redefined: it is the one irreversible operation in the
 *    campaign and this does not need to touch it.
 *
 *    The advisory lock serialises writes for one creator, so a draft cannot
 *    slip in beside an announcement of the same creator that has not
 *    committed yet. Lock order is safe: publish_weekly_winner takes its
 *    week-and-category lock before its single insert, and this lock is only
 *    ever taken after that, inside the insert.
 */

DROP INDEX IF EXISTS creator_of_week_once_per_campaign;

CREATE UNIQUE INDEX creator_of_week_once_per_campaign
  ON weekly_winners (campaign_id, campaign_creator_id)
  WHERE category = 'creator_of_week' AND published_at IS NOT NULL;

CREATE OR REPLACE FUNCTION refuse_second_creator_of_week()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'creator-of-week:' || NEW.campaign_id::text || ':' || NEW.campaign_creator_id::text,
      0
    )
  );

  IF EXISTS (
    SELECT 1 FROM weekly_winners w
     WHERE w.campaign_id = NEW.campaign_id
       AND w.category = 'creator_of_week'
       AND w.campaign_creator_id = NEW.campaign_creator_id
       AND w.published_at IS NOT NULL
       AND w.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'already_creator_of_week' USING ERRCODE = 'P0801';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS creator_of_week_once ON weekly_winners;

CREATE TRIGGER creator_of_week_once
  BEFORE INSERT OR UPDATE ON weekly_winners
  FOR EACH ROW
  WHEN (NEW.category = 'creator_of_week')
  EXECUTE FUNCTION refuse_second_creator_of_week();
