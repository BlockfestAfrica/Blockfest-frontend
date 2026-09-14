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

import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../helpers/migrations";

let db: PGlite;
let seq = 0;

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
  marketingOptIn?: boolean;
  accessTokenHash?: string;
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
      '1.2.3.4', 'test', '${code}', '1.0',
      ${opts.marketingOptIn ? "true" : "false"}, '1.0',
      ${opts.accessTokenHash ? `'${opts.accessTokenHash}'` : "NULL"}
    )`);
}

beforeAll(async () => {
  db = new PGlite();
  await applyMigrations(db);
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

  /**
   * Codes are minted from an uppercase alphabet with no O, 0, I or 1, chosen so
   * one can be read aloud over a voice note and typed back. A lower-case code
   * is therefore the expected shape of a hand-typed referral, and matching it
   * case-sensitively silently credited nobody: registration still succeeded and
   * neither party was told the referral had been dropped.
   */
  it("credits the referrer when the code was typed in lower case", async () => {
    await register({
      email: "shouter@example.com",
      phone: "+2348050000011",
      x: "shouter",
      code: "REFCODE9",
    });
    await register({
      email: "typer@example.com",
      phone: "+2348050000012",
      x: "typer",
      ref: "refcode9",
    });
    expect(await count(`SELECT count(*)::int AS n FROM referrals`)).toBe(1);
  });

  it("stores the code folded, so it joins back to the referrer", async () => {
    await register({
      email: "r2@example.com",
      phone: "+2348050000013",
      x: "rtwo",
      code: "REFCODE8",
    });
    await register({
      email: "t2@example.com",
      phone: "+2348050000014",
      x: "ttwo",
      ref: "RefCode8",
    });
    expect(
      await count(
        `SELECT count(*)::int AS n
           FROM referrals r
           JOIN campaign_creators cc
             ON cc.referral_code = r.code_used
          WHERE cc.id = r.referrer_campaign_creator_id`,
      ),
    ).toBe(1);
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

describe("consent", () => {
  it("records which version of the rules was accepted", async () => {
    // The rules page tells every registrant this is recorded. It was validated
    // and then discarded, so the promise was not kept. Since the rules can be
    // amended mid-campaign, "they accepted the rules" is not an answer.
    await register({
      email: "consent@example.com",
      phone: "+2348060000001",
      x: "consent",
    });
    const row = (
      await db.query<{
        accepted_rules_version: string;
        accepted_rules_at: string;
      }>(
        `SELECT accepted_rules_version, accepted_rules_at FROM campaign_creators
          ORDER BY joined_at DESC LIMIT 1`,
      )
    ).rows[0];
    expect(row.accepted_rules_version).toBe("1.0");
    expect(row.accepted_rules_at).toBeTruthy();
  });
});

/**
 * Marketing consent is a separate question from accepting the rules, because it
 * is a separate purpose. Bundling them would make the consent worthless and
 * take the campaign's own lawful basis down with it, so the two are recorded
 * independently and the default is no.
 */
describe("marketing consent", () => {
  it("defaults to no, and records no time for a no", async () => {
    await register({ email: "q@example.com", phone: "+2348060000001", x: "qq" });
    expect(
      await count(
        `SELECT count(*)::int AS n FROM creators
          WHERE email_canonical = 'q@example.com'
            AND marketing_opt_in = false
            AND marketing_opt_in_at IS NULL`,
      ),
    ).toBe(1);
  });

  it("records the moment consent was actually given", async () => {
    await register({
      email: "y@example.com",
      phone: "+2348060000002",
      x: "yy",
      marketingOptIn: true,
    });
    expect(
      await count(
        `SELECT count(*)::int AS n FROM creators
          WHERE email_canonical = 'y@example.com'
            AND marketing_opt_in = true
            AND marketing_opt_in_at IS NOT NULL`,
      ),
    ).toBe(1);
  });

  it("refuses a consent with no time against it", async () => {
    // The timestamp is the evidence. A true with no moment attached cannot
    // answer when somebody agreed, which is the only question that gets asked.
    await expect(
      db.query(`
        INSERT INTO creators (
          full_name, email, email_canonical, phone, phone_e164,
          content_niche, marketing_opt_in, marketing_opt_in_at
        ) VALUES (
          'X', 'z@example.com', 'z@example.com', '1', '+2348060000003',
          'finance', true, NULL
        )`),
    ).rejects.toThrow();
  });

  it("records which privacy notice was in force", async () => {
    await register({ email: "p@example.com", phone: "+2348060000004", x: "pp" });
    expect(
      await count(
        `SELECT count(*)::int AS n FROM creators
          WHERE email_canonical = 'p@example.com'
            AND privacy_notice_version = '1.0'`,
      ),
    ).toBe(1);
  });

  it("does not leave the old 17 argument function callable", async () => {
    // Adding parameters to a plpgsql function defines a second one beside the
    // first unless the first is dropped by its exact signature. Both would be
    // callable, and the old one would keep writing registrations that record
    // no consent at all.
    expect(
      await count(
        `SELECT count(*)::int AS n FROM pg_proc
          WHERE proname = 'register_creator'`,
      ),
    ).toBe(1);
  });
});

/**
 * The access token is how a creator proves who they are, with no email provider
 * in existence to fall back on. What has to hold is that the database stores
 * only a fingerprint, that the fingerprint finds exactly one enrolment, and
 * that two creators can never end up sharing one.
 */
describe("creator access tokens", () => {
  const hashOf = (token: string) =>
    createHash("sha256").update(token, "utf8").digest("hex");

  it("stores the hash and not the token", async () => {
    const token = "a".repeat(43);
    await register({
      email: "tok@example.com",
      phone: "+2348070000001",
      x: "tok",
      accessTokenHash: hashOf(token),
    });

    const rows = await db.query<{ access_token_hash: string }>(
      `SELECT cc.access_token_hash
         FROM campaign_creators cc
         JOIN creators c ON c.id = cc.creator_id
        WHERE c.email_canonical = 'tok@example.com'`,
    );
    expect(rows.rows[0].access_token_hash).toBe(hashOf(token));
    expect(rows.rows[0].access_token_hash).not.toBe(token);
  });

  it("finds exactly one enrolment from a hash", async () => {
    const mine = "b".repeat(43);
    await register({
      email: "mine@example.com",
      phone: "+2348070000002",
      x: "mine",
      accessTokenHash: hashOf(mine),
    });
    await register({
      email: "other@example.com",
      phone: "+2348070000003",
      x: "other",
      accessTokenHash: hashOf("c".repeat(43)),
    });

    const found = await db.query<{ email_canonical: string }>(
      `SELECT c.email_canonical
         FROM campaign_creators cc
         JOIN creators c ON c.id = cc.creator_id
        WHERE cc.access_token_hash = '${hashOf(mine)}'`,
    );
    expect(found.rows).toHaveLength(1);
    expect(found.rows[0].email_canonical).toBe("mine@example.com");
  });

  it("records when the token was issued", async () => {
    await register({
      email: "when@example.com",
      phone: "+2348070000004",
      x: "when",
      accessTokenHash: hashOf("d".repeat(43)),
    });
    expect(
      await count(
        `SELECT count(*)::int AS n FROM campaign_creators
          WHERE access_token_hash = '${hashOf("d".repeat(43))}'
            AND access_token_issued_at IS NOT NULL`,
      ),
    ).toBe(1);
  });

  it("refuses to let two enrolments share a token", async () => {
    const shared = hashOf("e".repeat(43));
    await register({
      email: "first@example.com",
      phone: "+2348070000005",
      x: "first",
      accessTokenHash: shared,
    });
    await expect(
      register({
        email: "second@example.com",
        phone: "+2348070000006",
        x: "second",
        accessTokenHash: shared,
      }),
    ).rejects.toThrow();
  });

  it("leaves the issued timestamp unset when there is no token", async () => {
    // The bot-detection path answers as though it succeeded and writes nothing,
    // but a null token must not look like one issued at the epoch.
    await register({
      email: "none@example.com",
      phone: "+2348070000007",
      x: "none",
    });
    expect(
      await count(
        `SELECT count(*)::int AS n FROM campaign_creators cc
           JOIN creators c ON c.id = cc.creator_id
          WHERE c.email_canonical = 'none@example.com'
            AND cc.access_token_hash IS NULL
            AND cc.access_token_issued_at IS NULL`,
      ),
    ).toBe(1);
  });

  it("does not leave the old 19 argument function callable", async () => {
    expect(
      await count(
        `SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'register_creator'`,
      ),
    ).toBe(1);
  });
});

describe("0044 registration integrity", () => {
  it("a voided referrer's code no longer resolves", async () => {
    await register({ email: "ref@a.com", phone: "+2341", code: "REFCODE1" });
    await db.query(
      `UPDATE campaign_creators SET status = 'disqualified'
        WHERE referral_code = 'REFCODE1'`,
    );
    await register({ email: "new@a.com", phone: "+2342", ref: "REFCODE1" });
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM referrals`,
    );
    expect(Number((rows[0] as { n: number }).n)).toBe(0);
  });

  it("an active referrer's code still resolves", async () => {
    await register({ email: "ref@b.com", phone: "+2343", code: "REFCODE2" });
    await register({ email: "new@b.com", phone: "+2344", ref: "REFCODE2" });
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM referrals`,
    );
    expect(Number((rows[0] as { n: number }).n)).toBe(1);
  });
});
