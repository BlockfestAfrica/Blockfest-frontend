/**
 * Editing the weekly briefs, against a real Postgres (#67).
 *
 * The requirement is the team publishing week 2 with zero developer
 * involvement, so what matters is that the edit is audited, that a draft is
 * genuinely invisible and unsubmittable, and that a finished week locks. The
 * draft and closed gates already existed in submit_entry; they are asserted
 * here THROUGH the editor's lifecycle so the acceptance criteria hold as one
 * story rather than as separate facts.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;
let seq = 0;
let campaignId: string;
let adminId: string;
let week2: string;

const one = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<T> =>
  (await db.query<T>(sql, p)).rows[0];

const edit = (
  challenge: string,
  fields: Partial<{ title: string; description: string; basePoints: number; status: string; startsAt: string; endsAt: string }>,
  admin: string | null = adminId,
) =>
  db.query(
    `SELECT * FROM update_challenge($1::uuid, $2::uuid, $3::text, $4::text, $5::integer, $6::challenge_status, $7::timestamptz, $8::timestamptz)`,
    [
      challenge,
      admin,
      fields.title ?? null,
      fields.description ?? null,
      fields.basePoints ?? null,
      fields.status ?? null,
      fields.startsAt ?? null,
      fields.endsAt ?? null,
    ],
  );

async function enrolled() {
  const tag = `${++seq}`;
  const creator = await one<{ id: string }>(`
    INSERT INTO creators (full_name, email, email_canonical, phone, phone_e164)
    VALUES ('C${tag}', 'c${tag}@e.com', 'c${tag}@e.com', '0${tag}', '+234${tag.padStart(10, "0")}')
    RETURNING id`);
  await db.query(
    `INSERT INTO creator_social_handles (creator_id, platform, handle, handle_normalized)
     VALUES ($1, 'x', $2, $2)`,
    [creator.id, `h${tag}`],
  );
  const enrolment = await one<{ id: string }>(`
    INSERT INTO campaign_creators (campaign_id, creator_id, referral_code)
    VALUES ('${campaignId}', '${creator.id}', 'CODE${tag}') RETURNING id`);
  return { enrolmentId: enrolment.id, handle: `h${tag}` };
}

const submitTo = (challenge: string, enrolment: string, handle: string) =>
  db.query(
    `SELECT * FROM submit_entry($1::uuid, $2::uuid, 'x'::platform, $3::text, true, $4::text)`,
    [enrolment, challenge, `https://x.com/${handle}/status/${++seq}0${seq}`, handle],
  );

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`
    DELETE FROM audit_log; DELETE FROM point_ledger; DELETE FROM submissions;
    DELETE FROM challenge_entries; DELETE FROM creator_social_handles;
    DELETE FROM campaign_creators; DELETE FROM creators;
  `);
  campaignId = (await one<{ id: string }>(`SELECT id FROM campaigns WHERE slug = 'monica-money-story'`)).id;
  adminId = (await one<{ id: string }>(`SELECT id FROM admin_users WHERE email_canonical = 'partnership@blockfestafrica.com'`)).id;
  week2 = (await one<{ id: string }>(`SELECT id FROM challenges WHERE campaign_id = '${campaignId}' AND week_no = 2`)).id;
  // Reset week 2 to a known live state, whatever an earlier test did to it.
  await db.query(
    `UPDATE challenges SET status = 'active', base_points = 100,
            starts_at = now() - interval '1 day', ends_at = now() + interval '5 days'
      WHERE id = $1`,
    [week2],
  );
});

describe("the weekly publish, as the team will do it", () => {
  it("draft, write, activate: the whole Monday in three calls", async () => {
    const { enrolmentId, handle } = await enrolled();

    await edit(week2, { status: "draft" });
    // A draft is unsubmittable, which is what makes writing in place safe.
    await expect(submitTo(week2, enrolmentId, handle)).rejects.toThrow(/challenge_closed/);

    await edit(week2, { title: "The Problem", description: "Real stories about financial friction." });
    await edit(week2, { status: "active" });

    await expect(submitTo(week2, enrolmentId, handle)).resolves.toBeTruthy();
  });

  it("closing stops new entries and leaves existing ones reviewable", async () => {
    const a = await enrolled();
    const posted = await submitTo(week2, a.enrolmentId, a.handle);
    const submission = (posted.rows[0] as { submission_id: string }).submission_id;

    await edit(week2, { status: "closed" });

    const b = await enrolled();
    await expect(submitTo(week2, b.enrolmentId, b.handle)).rejects.toThrow(/challenge_closed/);
    await expect(
      db.query(`SELECT review($1::uuid, 'rejected'::submission_status, $2::uuid, 'note')`, [submission, adminId]),
    ).resolves.toBeTruthy();
  });

  it("a base points change touches only entries created after it", async () => {
    const before = await enrolled();
    await submitTo(week2, before.enrolmentId, before.handle);

    await edit(week2, { basePoints: 150 });

    const after = await enrolled();
    await submitTo(week2, after.enrolmentId, after.handle);

    const snapshots = await db.query<{ base_points_snapshot: number }>(
      `SELECT ce.base_points_snapshot FROM challenge_entries ce
        WHERE ce.challenge_id = $1 ORDER BY ce.created_at`,
      [week2],
    );
    expect(snapshots.rows.map((r) => Number(r.base_points_snapshot))).toEqual([100, 150]);
  });
});

describe("the audit", () => {
  it("records exactly the fields that moved, before and after", async () => {
    await edit(week2, { title: "Renamed", basePoints: 120 });

    const row = await one<{ after: Record<string, { from: unknown; to: unknown }> }>(
      `SELECT after FROM audit_log WHERE action = 'challenge.updated'`,
    );
    expect(row.after.title).toEqual({ from: "The Problem", to: "Renamed" });
    expect(row.after.base_points).toEqual({ from: 100, to: 120 });
    expect(row.after.description, "unchanged fields stay out").toBeUndefined();
  });
});

describe("what it refuses", () => {
  it("editing a week that has ended", async () => {
    await db.query(
      `UPDATE challenges SET starts_at = now() - interval '10 days', ends_at = now() - interval '3 days' WHERE id = $1`,
      [week2],
    );
    await expect(edit(week2, { title: "Rewriting history" })).rejects.toThrow(/challenge_readonly/);
  });

  it("an inverted window, zero points, a missing admin, an unknown challenge", async () => {
    await expect(
      edit(week2, { startsAt: "2026-09-25T00:00:00+01:00", endsAt: "2026-09-24T00:00:00+01:00" }),
    ).rejects.toThrow(/window_inverted/);
    await expect(edit(week2, { basePoints: 0 })).rejects.toThrow(/points_required/);
    await expect(edit(week2, { title: "x" }, null)).rejects.toThrow(/admin_required/);
    await expect(
      edit("00000000-0000-0000-0000-000000000000", { title: "x" }),
    ).rejects.toThrow(/unknown_challenge/);
  });

  it("refuses a window that overlaps another week", async () => {
    // Two open windows at once would file entries against whichever week
    // the route's unordered pick found first, so the editor refuses to
    // create the state at all.
    await expect(
      edit(week2, {
        startsAt: "2026-09-17T00:00:00+01:00",
        endsAt: "2026-09-23T23:59:59+01:00",
      }),
    ).rejects.toThrow(/window_overlaps/);
  });
});
