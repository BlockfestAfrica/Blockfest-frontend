-- Repair entries frozen under the pre-0030 linear ladder.
--
-- 0030 changed the platform ladder from 100/200/300 to 100/150/200 and
-- deliberately left in-flight entries on the ladder they were created
-- under, reasoning "pre-launch there are no such rows anyway". There was
-- at least one: a test entry created on 12 September survived the data
-- purge, kept bonus snapshots of 100/200, and was paid 300 for three
-- platforms after launch. The published rules and every page say 200.
--
-- This re-snapshots exactly the entries carrying the old pair and
-- recomputes each one. recompute_entry_award writes the difference as a
-- ledger correction row, which is the shape the rules promise for a
-- mistake we made, and points_total follows from the ledger sum as
-- always. Entries created after 0030 carry 50/100 already and match
-- their target, so recomputing them is a no-op and they are not touched
-- here. Idempotent: on a second run the WHERE matches nothing.

DO $$
DECLARE
  v_entry uuid;
BEGIN
  FOR v_entry IN
    SELECT e.id
      FROM challenge_entries e
      JOIN campaign_creators cc ON cc.id = e.campaign_creator_id
      JOIN campaigns c ON c.id = cc.campaign_id
     WHERE c.slug = 'monica-money-story'
       AND e.bonus_2_snapshot = 100
       AND e.bonus_3_snapshot = 200
  LOOP
    UPDATE challenge_entries
       SET bonus_2_snapshot = 50,
           bonus_3_snapshot = 100,
           updated_at = now()
     WHERE id = v_entry;

    PERFORM recompute_entry_award(v_entry);
  END LOOP;
END $$;
