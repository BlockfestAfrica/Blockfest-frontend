/**
 * Registration, against a real Postgres.
 *
 * Two defects are covered here, both of which only appear once real people are
 * registering and neither of which a unit test would have found.
 *
 * The first was that registration was four separate commits over a driver with
 * no interactive transactions. A collision on the second left the first behind,
 * so a creators row could be stranded holding an email address and a phone
 * number with no enrolment attached and nothing to release them. That is not
 * only untidy: sending a victim's email together with a handle already taken
 * was enough to stop that person ever registering, and the message they would
 * see said their email was already registered, which was true.
 *
 * The second was that a social handle was claimed permanently by whoever typed
 * it first, with nothing checking they controlled the account. The exclusivity
 * now belongs to a verified handle, so a squat no longer locks anybody out.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
let seq = 0;
const uniq = () => `${Date.now()}-${++seq}`;

const count = async (sql: string) =>
  Number((await db.query<{ n: number }>(sql)).rows[0].n);

/** Calls register_creator the way the endpoint does. */
async function register(opts: {
  email: string;
  phone: string;
  x?: string;
  instagram?: string;
  ref?: string;
  code?: string;
}) {
  // Not derived from a timestamp and sliced: truncating cut off the part that
  // differed, two registrations collided on referral_code, and the failure
  // looked exactly like the handle-uniqueness behaviour under test.
  const code = opts.code ?? `CODE${++seq}`;
  return db.query(`
    SELECT * FROM register_creator(
      'monica', 'Creator', '${opts.email}', '${opts.email}',
      '${opts.phone}', '${opts.phone}', 'finance',
      NULL, NULL,
      ${opts.x ? `'${opts.x}'` : "NULL"},
      ${opts.instagram ? `'${opts.instagram}'` : "NULL"},
      NULL,
      ${opts.ref ? `'${opts.ref}'` : "NULL"},
      '1.2.3.4', 'test', '${code}'
    )`);
}

beforeAll(async () => {
  db = new PGlite();
  const dir = join(process.cwd(), "drizzle");
  for (const f of [
    "0000_init.sql",
    "0001_points_engine.sql",
    "0002_atomic_registration.sql",
  ]) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
}, 60_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`
    DELETE FROM referrals; DELETE FROM creator_social_handles;
    DELETE FROM campaign_creators; DELETE FROM creators; DELETE FROM campaigns;
    INSERT INTO campaigns (slug, name, status) VALUES ('monica', 'Monica', 'active');
  `);
});

describe("a registration that fails", () => {
  /**
   * The failure has to happen AFTER the creators row is written, or the test
   * proves nothing. Email and phone collisions are checked first and raise
   * before anything is inserted, so they cannot show a rollback. A referral
   * code collision can: the creators row and the handle rows are already
   * written by the time campaign_creators is attempted.
   */
  const collideOnReferralCode = async () => {
    await register({
      email: "holder@example.com",
      phone: "+2348010000099",
      x: "holder",
      code: "TAKENCODE",
    });
    return register({
      email: "victim@example.com",
      phone: "+2348010000098",
      x: "victimhandle",
      code: "TAKENCODE",
    });
  };

  it("leaves nothing at all behind", async () => {
    // The defect this replaced: the creators row committed on its own round
    // trip, so a later failure stranded it holding an email and a phone.
    const before = await count(`SELECT count(*)::int AS n FROM creators`);
    await expect(collideOnReferralCode()).rejects.toThrow();

    // One creator from the setup call, none from the failed one.
    expect(await count(`SELECT count(*)::int AS n FROM creators`)).toBe(
      before + 1,
    );
    expect(
      await count(
        `SELECT count(*)::int AS n FROM creators WHERE email_canonical = 'victim@example.com'`,
      ),
    ).toBe(0);
  });

  it("rolls back the handle rows too, not just the creator", async () => {
    await expect(collideOnReferralCode()).rejects.toThrow();
    expect(
      await count(
        `SELECT count(*)::int AS n FROM creator_social_handles WHERE handle_normalized = 'victimhandle'`,
      ),
    ).toBe(0);
  });

  it("does not hold the email hostage afterwards", async () => {
    // The point of the whole fix. A stranded row would have made this address
    // permanently unusable, and the person would have been told it was already
    // registered, which would have been true and unactionable.
    await expect(collideOnReferralCode()).rejects.toThrow();
    await expect(
      register({
        email: "victim@example.com",
        phone: "+2348010000098",
        x: "victimhandle",
      }),
    ).resolves.toBeTruthy();
  });

  it("never leaves an enrolment without its creator, or the reverse", async () => {
    await register({
      email: "a@example.com",
      phone: "+2348010000010",
      x: "aaa",
    });
    await expect(collideOnReferralCode()).rejects.toThrow();
    expect(
      await count(`
      SELECT count(*)::int AS n FROM creators c
       WHERE NOT EXISTS (SELECT 1 FROM campaign_creators cc WHERE cc.creator_id = c.id)`),
    ).toBe(0);
  });
});

describe("claiming a handle", () => {
  it("lets two people claim the same handle while neither has proven it", async () => {
    // Otherwise the first person to type a well-known creator's handle locks
    // that creator out of a ₦5,000,000 campaign permanently.
    await register({
      email: "squatter@example.com",
      phone: "+2348020000001",
      x: "bigcreator",
    });
    await expect(
      register({
        email: "real@example.com",
        phone: "+2348020000002",
        x: "bigcreator",
      }),
    ).resolves.toBeTruthy();

    expect(
      await count(
        `SELECT count(*)::int AS n FROM creator_social_handles WHERE handle_normalized = 'bigcreator'`,
      ),
    ).toBe(2);
  });

  it("allows only one of them to ever prove it", async () => {
    await register({
      email: "squatter@example.com",
      phone: "+2348020000001",
      x: "bigcreator",
    });
    await register({
      email: "real@example.com",
      phone: "+2348020000002",
      x: "bigcreator",
    });

    const rows = await db.query<{ id: string }>(
      `SELECT id FROM creator_social_handles WHERE handle_normalized = 'bigcreator' ORDER BY created_at`,
    );
    await db.query(
      `UPDATE creator_social_handles SET verified_at = now() WHERE id = '${rows.rows[0].id}'`,
    );
    await expect(
      db.query(
        `UPDATE creator_social_handles SET verified_at = now() WHERE id = '${rows.rows[1].id}'`,
      ),
    ).rejects.toThrow();
  });

  it("starts every claim unproven", async () => {
    // Nothing in registration can check that somebody controls an account, so
    // nothing in registration may mark one as proven.
    await register({
      email: "a@example.com",
      phone: "+2348030000001",
      x: "somebody",
    });
    expect(
      await count(
        `SELECT count(*)::int AS n FROM creator_social_handles WHERE verified_at IS NOT NULL`,
      ),
    ).toBe(0);
  });
});

describe("duplicates", () => {
  it("refuses a second registration on the same email", async () => {
    await register({
      email: "dupe@example.com",
      phone: "+2348040000001",
      x: "one",
    });
    await expect(
      register({
        email: "dupe@example.com",
        phone: "+2348040000002",
        x: "two",
      }),
    ).rejects.toThrow(/email_taken/);
  });

  it("refuses a second registration on the same phone", async () => {
    await register({
      email: "one@example.com",
      phone: "+2348040000003",
      x: "three",
    });
    await expect(
      register({
        email: "two@example.com",
        phone: "+2348040000003",
        x: "four",
      }),
    ).rejects.toThrow(/phone_taken/);
  });
});

describe("referrals", () => {
  it("records who sent a creator", async () => {
    await register({
      email: "referrer@example.com",
      phone: "+2348050000001",
      x: "referrer",
      code: "REFCODE1",
    });
    await register({
      email: "referred@example.com",
      phone: "+2348050000002",
      x: "referred",
      ref: "REFCODE1",
    });
    expect(await count(`SELECT count(*)::int AS n FROM referrals`)).toBe(1);
  });

  it("ignores a code that belongs to nobody rather than failing", async () => {
    // The person registering did nothing wrong and should not be stopped by
    // somebody else's broken link.
    await expect(
      register({
        email: "a@example.com",
        phone: "+2348050000003",
        x: "aaa",
        ref: "NOSUCHCODE",
      }),
    ).resolves.toBeTruthy();
    expect(await count(`SELECT count(*)::int AS n FROM referrals`)).toBe(0);
  });
});
