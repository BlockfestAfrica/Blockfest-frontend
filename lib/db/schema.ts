/**
 * MONICA: THE MONEY STORY — campaign platform schema.
 * Intended path: lib/db/schema.ts
 *
 * Design rules this file enforces, in order of how expensive they are to get
 * wrong (₦5,000,000 of prize money is settled from these tables):
 *
 *  1. A creator's participation in a campaign is `campaign_creators`, not
 *     `creators`. A person is one row forever; their run in MONICA and their
 *     later run in Rovv are two enrolments. Without this, a second campaign
 *     forces duplicate creator rows and the email/phone uniqueness that the
 *     whole anti-fraud story rests on has to be dropped.
 *  2. ONE row in `challenge_entries` per (enrolment, challenge) — enforced by a
 *     unique constraint, not by application care. Per-platform rows hang off
 *     it. It is structurally impossible for one entry to count as three.
 *  3. `point_ledger` is append-only and is the sole truth for points. Every
 *     correction is a new signed row. Nothing is ever UPDATEd or DELETEd.
 *  4. Scoring rates are SNAPSHOT onto the entry when it is created. Changing a
 *     configured point value never retroactively re-prices work already done.
 */

import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ enums */

/**
 * Exactly three values, and that cardinality is load-bearing: combined with
 * UNIQUE(entry_id, platform) on submissions it caps an entry at three platform
 * rows with no trigger and no application check. Adding a fourth platform is
 * therefore a deliberate migration that forces you to revisit the bonus tiers.
 */
export const platformEnum = pgEnum("platform", ["x", "instagram", "tiktok"]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
]);

export const challengeTypeEnum = pgEnum("challenge_type", [
  "regular",
  "wildcard",
  "final",
]);

export const challengeStatusEnum = pgEnum("challenge_status", [
  "draft",
  "active",
  "closed",
]);

/** `coming_soon` is what renders Rovv on /campaigns without any code change. */
export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "coming_soon",
  "active",
  "closed",
  "archived",
]);

/**
 * Why every award kind is an enum value rather than free text: the admin
 * "add bonus points" screen must not be able to invent a source that the
 * reconciliation job does not know how to verify. `challenge_entry` is the
 * only source the engine computes; everything else is a human decision.
 */
export const ledgerSourceEnum = pgEnum("ledger_source", [
  "challenge_entry",
  "quality_bonus",
  "engagement_milestone",
  "featured_blockfest",
  "featured_monica",
  "collab",
  "wildcard_win",
  "referral",
  "manual_adjustment",
]);

export const winnerCategoryEnum = pgEnum("winner_category", [
  "creator_of_week",
  "community_favourite",
]);

export const voteRoundStatusEnum = pgEnum("vote_round_status", [
  "draft",
  "open",
  "closed",
  "published",
]);

/** Suspicious votes are marked `removed`, never deleted — admits an audit. */
export const voteStatusEnum = pgEnum("vote_status", ["counted", "removed"]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "active",
  "suspended",
  "disqualified",
]);

export const adminRoleEnum = pgEnum("admin_role", ["owner", "reviewer"]);

/* -------------------------------------------------------------- campaigns */

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** URL segment: /campaigns/monica-the-money-story */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline"),
    status: campaignStatusEnum("status").notNull().default("draft"),

    startsAt: timestamp("starts_at", { withTimezone: true }),
    /**
     * The pause switch. Deliberately separate from `status`, because closed
     * means the campaign has ended and a pause has to be reversible without
     * looking like an ending.
     */
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    /** Shown to creators verbatim. A pause with no reason is refused. */
    pausedReason: text("paused_reason"),
    pausedByAdminId: uuid("paused_by_admin_id"),
    endsAt: timestamp("ends_at", { withTimezone: true }),

    /** Everything date-derived (week_no, voting windows) resolves in WAT. */
    timezone: text("timezone").notNull().default("Africa/Lagos"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("campaigns_slug_key").on(t.slug),
    index("campaigns_status_idx").on(t.status),
    check("campaigns_dates_ordered", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

/* ---------------------------------------------------------------- people */

/**
 * A human being, independent of any campaign.
 *
 * The `*_canonical` columns exist because uniqueness on the raw value is
 * worthless. `Ada@Gmail.com`, `ada@gmail.com` and `a.d.a+monica@gmail.com` are
 * one inbox; `08031234567` and `+2348031234567` are one phone. Duplicate
 * accounts are how a referral scheme gets farmed, so the canonical forms carry
 * the UNIQUE index and the display forms carry the truth we show back to them.
 */
export const creators = pgTable(
  "creators",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    fullName: text("full_name").notNull(),

    email: text("email").notNull(),
    /** lowercased, trimmed; for gmail: dots stripped and +tag removed. */
    emailCanonical: text("email_canonical").notNull(),

    phone: text("phone").notNull(),
    /** E.164, e.g. +2348031234567. */
    phoneE164: text("phone_e164").notNull(),

    /**
     * What they said they make. Kept for the creators who gave it, and no
     * longer asked for: nothing ever read it back.
     */
    contentNiche: text("content_niche"),

    /**
     * Their username on Monica, and how prize money reaches them.
     *
     * Nullable here and required by the form. Rows written before 0032 cannot
     * have one, and a placeholder default would mean "we have their tag" for
     * creators whose tag we do not have, which is the one thing this column
     * exists to tell us.
     */
    monicaTag: text("monica_tag"),
    audienceSize: integer("audience_size"),
    location: text("location"),

    /**
     * Kept for after-the-fact cluster detection: twelve accounts from one IP
     * inside ten minutes is the signature of referral farming. Not used to
     * block at registration — shared carrier NAT is normal in Nigeria and
     * would lock out real creators.
     */
    registrationIp: text("registration_ip"),
    registrationUserAgent: text("registration_user_agent"),

    /**
     * Consent to hear about future campaigns. Separate from accepting the
     * rules, because it is a different purpose and cannot ride on the
     * agreement to run an entry. Defaults to false: an unanswered question is
     * a no.
     */
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    /** Set only where the answer was yes. Proving when is the point. */
    marketingOptInAt: timestamp("marketing_opt_in_at", { withTimezone: true }),
    /** Which privacy notice was in force, since it can be amended. */
    privacyNoticeVersion: text("privacy_notice_version"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("creators_email_canonical_key").on(t.emailCanonical),
    uniqueIndex("creators_phone_e164_key").on(t.phoneE164),
    check(
      "creators_audience_size_sane",
      sql`${t.audienceSize} IS NULL OR ${t.audienceSize} >= 0`,
    ),
  ],
);

/**
 * One row per social account. UNIQUE(platform, handle_normalized) means an X
 * handle can belong to exactly one creator across the whole platform — the
 * single strongest duplicate-account control available, because the handle is
 * also what must appear in the submitted URL. It turns "is this really your
 * post?" into a join rather than a judgement call.
 */
export const creatorSocialHandles = pgTable(
  "creator_social_handles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    /** As typed, for display. */
    handle: text("handle").notNull(),
    /** lowercased, leading @ stripped. */
    handleNormalized: text("handle_normalized").notNull(),
    /**
     * When ownership of this account was actually proven.
     *
     * Null means claimed but unproven. Registration cannot check that somebody
     * controls the account they typed, so a claim is only a claim: unverified
     * rows may collide with each other, and must never be used to attribute an
     * entry to a creator. Exclusivity belongs to proof, not to whoever typed it
     * first, or the handles of well-known creators can be taken in bulk.
     */
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    /** Shown to the creator, published from the account, confirmed by a person. */
    verificationCode: text("verification_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Partial: only a proven handle is exclusive. Two people may both claim
    // the same unverified handle; at most one of them can ever verify it.
    uniqueIndex("social_handle_unique_verified")
      .on(t.platform, t.handleNormalized)
      .where(sql`${t.verifiedAt} is not null`),
    uniqueIndex("social_handle_one_per_creator_platform").on(
      t.creatorId,
      t.platform,
    ),
    index("social_handle_creator_idx").on(t.creatorId),
  ],
);

/* ------------------------------------------------------------- enrolment */

/**
 * A creator's participation in ONE campaign. This is the row the leaderboard
 * ranks and the row points attach to.
 *
 * `pointsTotal` and `approvedEntriesCount` are caches, not truth. They exist so
 * the public leaderboard is an index scan instead of a ledger aggregate on a
 * page that gets hammered every Saturday. They are written in the same
 * transaction as the ledger row and are provable against it — see the
 * reconciliation invariant in the notes.
 */
export const campaignCreators = pgTable(
  "campaign_creators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),

    /**
     * Globally unique, so /join?ref=CODE resolves the campaign as well as the
     * referrer and the link cannot be replayed into a different campaign.
     */
    referralCode: text("referral_code").notNull(),

    status: enrollmentStatusEnum("status").notNull().default("active"),

    pointsTotal: integer("points_total").notNull().default(0),
    approvedEntriesCount: integer("approved_entries_count")
      .notNull()
      .default(0),

    /** Tie-break for ranking; set on the creator's first approved platform. */
    firstApprovedAt: timestamp("first_approved_at", { withTimezone: true }),

    /**
     * SHA-256 of the creator's access token. The token itself is shown once at
     * registration and is not recoverable from here, which is the point: the
     * database alone is not enough to act as somebody.
     */
    accessTokenHash: text("access_token_hash"),
    accessTokenIssuedAt: timestamp("access_token_issued_at", {
      withTimezone: true,
    }),
    /**
     * Which version of the rules this creator accepted, and when.
     *
     * The rules page tells every registrant that the version in force when they
     * register is recorded against their entry, and the rules may be amended
     * mid-campaign. Without this, "they accepted the rules" is not an answer to
     * a dispute, because it does not say what they accepted.
     */
    acceptedRulesVersion: text("accepted_rules_version"),
    acceptedRulesAt: timestamp("accepted_rules_at", { withTimezone: true }),

    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("campaign_creator_unique").on(t.campaignId, t.creatorId),
    uniqueIndex("referral_code_key").on(t.referralCode),
    /** The leaderboard's covering index; matches the ORDER BY exactly. */
    index("leaderboard_idx").on(
      t.campaignId,
      t.pointsTotal.desc(),
      t.approvedEntriesCount.desc(),
      t.firstApprovedAt.asc(),
    ),
    check("points_total_non_negative", sql`${t.pointsTotal} >= 0`),
    check("approved_entries_non_negative", sql`${t.approvedEntriesCount} >= 0`),
  ],
);

/* ------------------------------------------------------------ challenges */

export const challenges = pgTable(
  "challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    description: text("description").notNull(),

    /**
     * week_no 1..5. The campaign is 34 days: four Mon-Sat stages carrying
     * the four weekly prizes, then a fifth Mon-Sat stage (12 - 17 Oct) which
     * is the finale and carries the final prize, not a weekly one. The Sunday
     * between stages is kept clear for review and the weekly announcement.
     * `stage` is 1..4 and is NULL for the finale, which is what marks a week
     * as one of the four weekly rounds rather than the final one.
     */
    weekNo: smallint("week_no").notNull(),
    stage: smallint("stage"),

    type: challengeTypeEnum("type").notNull().default("regular"),
    status: challengeStatusEnum("status").notNull().default("draft"),

    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

    /**
     * The value of a ONE-platform entry. Multi-platform totals are this plus
     * the tier bonus. Defaulted from campaign config at creation, then owned
     * by the challenge so a wildcard week can be worth more.
     */
    basePoints: integer("base_points").notNull().default(100),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    /**
     * Stops the commonest admin slip: two "Week 3" regular challenges, which
     * would silently let a creator bank two entries for one week's work.
     * Wildcards are exempt by design, so the index is partial.
     */
    uniqueIndex("one_regular_challenge_per_week")
      .on(t.campaignId, t.weekNo)
      .where(sql`type = 'regular'`),
    index("challenges_campaign_status_idx").on(t.campaignId, t.status),
    check("challenge_week_range", sql`${t.weekNo} BETWEEN 1 AND 5`),
    check(
      "challenge_stage_range",
      sql`${t.stage} IS NULL OR ${t.stage} BETWEEN 1 AND 4`,
    ),
    check("challenge_dates_ordered", sql`${t.endsAt} > ${t.startsAt}`),
    check("challenge_base_points_positive", sql`${t.basePoints} > 0`),
  ],
);

/* ------------------------------------------- entries and per-platform rows */

/**
 * THE grouping row. One per creator per challenge, guaranteed by
 * `entry_unique`. Everything that counts a "completion" counts rows here.
 *
 * The rate snapshot columns are the answer to "does changing a point value
 * retroactively change scores?" — no. An entry is priced at the rates that
 * were live when it was opened, and those numbers live on the row. An admin
 * raising base points on Wednesday cannot silently re-price Monday's work,
 * including work that is still half-reviewed.
 */
export const challengeEntries = pgTable(
  "challenge_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignCreatorId: uuid("campaign_creator_id")
      .notNull()
      .references(() => campaignCreators.id, { onDelete: "cascade" }),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),

    /** Maintained by the recompute; 0..3. */
    approvedPlatformCount: smallint("approved_platform_count")
      .notNull()
      .default(0),

    /** Mirror of SUM(point_ledger) for this entry. Cache, not truth. */
    awardedPoints: integer("awarded_points").notNull().default(0),

    /**
     * Rate snapshot. Stored as absolute TOTALS per tier, never as deltas:
     * a 3-platform entry is worth `bonus3Snapshot + basePoints`… no — it is
     * worth exactly `basePointsSnapshot + bonusNSnapshot`. Totals rather than
     * "+100 then +200 more" removes an entire class of accumulation bug and
     * makes the admin screen unambiguous.
     */
    basePointsSnapshot: integer("base_points_snapshot").notNull(),
    bonus2Snapshot: integer("bonus_2_snapshot").notNull(),
    bonus3Snapshot: integer("bonus_3_snapshot").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("entry_unique").on(t.campaignCreatorId, t.challengeId),
    index("entry_creator_idx").on(t.campaignCreatorId),
    index("entry_challenge_idx").on(t.challengeId),
    check(
      "approved_platform_count_range",
      sql`${t.approvedPlatformCount} BETWEEN 0 AND 3`,
    ),
    check("awarded_points_non_negative", sql`${t.awardedPoints} >= 0`),
    check(
      "bonus_tiers_monotonic",
      sql`${t.bonus3Snapshot} >= ${t.bonus2Snapshot} AND ${t.bonus2Snapshot} >= 0`,
    ),
  ],
);

/**
 * One row per platform URL. Reviewed individually — the admin can reject the
 * TikTok while approving the X and Instagram, and the entry re-prices itself
 * down to the two-platform tier.
 *
 * Deliberately NOT carrying campaign_creator_id. The admin queue has to join
 * through `challenge_entries` to learn whose submission this is, and that join
 * is the guardrail: there is no column here that would let someone write
 * `COUNT(*) FROM submissions GROUP BY creator` and get a plausible-looking,
 * triple-counted "entries completed" number.
 */
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => challengeEntries.id, { onDelete: "cascade" }),

    platform: platformEnum("platform").notNull(),
    url: text("url").notNull(),

    status: submissionStatusEnum("status").notNull().default("pending"),

    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByAdminId: uuid("reviewed_by_admin_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
    reviewNote: text("review_note"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    /** One URL per platform per entry — and with a 3-value enum, max 3 rows. */
    uniqueIndex("submission_one_per_platform").on(t.entryId, t.platform),
    /** Stops the same post being submitted under two different entries. */
    // Partial on status. A rejected submission releases its URL: while the
    // index ignored status, the first person to submit a URL owned it forever,
    // so any public post could be burned before its author got there.
    uniqueIndex("submission_url_unique_active")
      .on(t.url)
      .where(sql`${t.status} <> 'rejected'`),
    index("submission_status_idx").on(t.status, t.submittedAt),
    index("submission_entry_idx").on(t.entryId),
    check(
      "submission_reviewed_consistently",
      sql`(${t.status} = 'pending' AND ${t.reviewedAt} IS NULL)
          OR (${t.status} <> 'pending' AND ${t.reviewedAt} IS NOT NULL)`,
    ),
    check("submission_url_is_http", sql`${t.url} ~* '^https://'`),
  ],
);

/* ------------------------------------------------------------ point rules */

/**
 * Admin-configurable point values, one row per key per campaign.
 *
 * `defaultPoints` seeds the admin form; `minPoints`/`maxPoints` bound what a
 * reviewer may hand out (the brief's "+50..200" ranges) so a slipped keystroke
 * cannot mint 20,000 points. These bounds are validated at award time — they
 * are not retroactive, because the ledger already holds resolved amounts.
 */
export const pointRules = pgTable(
  "point_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),

    /**
     * e.g. entry_base, multi_platform_bonus_2, multi_platform_bonus_3,
     * referral, quality_bonus, engagement_milestone, featured_blockfest,
     * featured_monica, collab, wildcard_win.
     */
    key: text("key").notNull(),

    defaultPoints: integer("default_points").notNull(),
    minPoints: integer("min_points"),
    maxPoints: integer("max_points"),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedByAdminId: uuid("updated_by_admin_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
  },
  (t) => [
    uniqueIndex("point_rule_key_unique").on(t.campaignId, t.key),
    check(
      "point_rule_bounds_ordered",
      sql`(${t.minPoints} IS NULL OR ${t.maxPoints} IS NULL OR ${t.minPoints} <= ${t.maxPoints})`,
    ),
  ],
);

/* ----------------------------------------------------------- point ledger */

/**
 * Append-only. Never UPDATE, never DELETE. A creator asking "why do I have 740
 * points?" gets a line-by-line answer, and so does anyone auditing a ₦1.5m
 * payout.
 *
 * `points` is signed: taking points back (a platform rejected on review) is a
 * negative row, not an edit. `entryId` is set only for `challenge_entry` rows,
 * which is what makes the per-entry recompute a bounded, idempotent SUM.
 */
export const pointLedger = pgTable(
  "point_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    campaignCreatorId: uuid("campaign_creator_id")
      .notNull()
      .references(() => campaignCreators.id, { onDelete: "cascade" }),

    source: ledgerSourceEnum("source").notNull(),
    points: integer("points").notNull(),

    /** Set iff source = 'challenge_entry'. */
    entryId: uuid("entry_id").references(() => challengeEntries.id, {
      onDelete: "cascade",
    }),

    /** Required for every human-decided award — the brief's "with a note". */
    note: text("note"),

    awardedByAdminId: uuid("awarded_by_admin_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),

    /**
     * Protects manual awards from a double-clicked Approve button. The entry
     * recompute does not need it — it is idempotent by construction (it writes
     * target-minus-current, which is zero on a second run).
     */
    idempotencyKey: text("idempotency_key"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ledger_creator_idx").on(t.campaignCreatorId, t.createdAt),
    index("ledger_entry_idx").on(t.entryId),
    uniqueIndex("ledger_idempotency_key")
      .on(t.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL`),
    check("ledger_points_non_zero", sql`${t.points} <> 0`),
    check(
      "ledger_entry_id_iff_entry_source",
      sql`(${t.source} = 'challenge_entry' AND ${t.entryId} IS NOT NULL)
          OR (${t.source} <> 'challenge_entry' AND ${t.entryId} IS NULL)`,
    ),
    /** Every human-decided award is attributable and explained. */
    check(
      "ledger_manual_awards_attributed",
      sql`${t.source} = 'challenge_entry'
          OR ${t.source} = 'referral'
          OR (${t.awardedByAdminId} IS NOT NULL AND ${t.note} IS NOT NULL)`,
    ),
  ],
);

/* -------------------------------------------------------------- referrals */

/**
 * The record of one attribution. Truth lives here, not as a pointer on
 * campaign_creators, so there is exactly one place to reason about.
 *
 *  - UNIQUE(referred_campaign_creator_id): you can be referred once, ever.
 *  - CHECK(referrer <> referred): self-referral is impossible at the storage
 *    layer, so no code path can forget the check.
 *
 * What these constraints CANNOT stop is one human making a second account to
 * refer themselves. That is stopped upstream, by the canonical email, E.164
 * phone and social-handle uniqueness on `creators` — and by paying the bonus
 * on first APPROVED entry rather than on registration (see `awardedLedgerId`
 * staying NULL until then).
 */
export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),

    referrerCampaignCreatorId: uuid("referrer_campaign_creator_id")
      .notNull()
      .references(() => campaignCreators.id, { onDelete: "cascade" }),
    referredCampaignCreatorId: uuid("referred_campaign_creator_id")
      .notNull()
      .references(() => campaignCreators.id, { onDelete: "cascade" }),

    /** The literal code used, kept even if the referrer later rotates it. */
    codeUsed: text("code_used").notNull(),

    /** NULL until the bonus actually pays out. */
    awardedLedgerId: uuid("awarded_ledger_id").references(
      () => pointLedger.id,
      {
        onDelete: "set null",
      },
    ),
    awardedAt: timestamp("awarded_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("referred_once_ever").on(t.referredCampaignCreatorId),
    index("referrer_idx").on(t.referrerCampaignCreatorId),
    check(
      "no_self_referral",
      sql`${t.referrerCampaignCreatorId} <> ${t.referredCampaignCreatorId}`,
    ),
    check(
      "referral_award_consistent",
      sql`(${t.awardedLedgerId} IS NULL AND ${t.awardedAt} IS NULL)
          OR (${t.awardedLedgerId} IS NOT NULL AND ${t.awardedAt} IS NOT NULL)`,
    ),
  ],
);

/* --------------------------------------------------------- weekly winners */

export const weeklyWinners = pgTable(
  "weekly_winners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),

    weekNo: smallint("week_no").notNull(),
    category: winnerCategoryEnum("category").notNull(),

    campaignCreatorId: uuid("campaign_creator_id")
      .notNull()
      .references(() => campaignCreators.id, { onDelete: "cascade" }),

    /** The winning entry, for Community Favourite. */
    entryId: uuid("entry_id").references(() => challengeEntries.id, {
      onDelete: "set null",
    }),

    prizeAmountNaira: integer("prize_amount_naira").notNull(),
    note: text("note"),

    /** Nothing is public until the admin publishes it on the Sunday. */
    publishedAt: timestamp("published_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    /** One winner per category per week. */
    uniqueIndex("one_winner_per_category_per_week").on(
      t.campaignId,
      t.weekNo,
      t.category,
    ),
    /**
     * "The same creator cannot win Creator of the Week twice" — expressed as a
     * partial unique index so the database refuses it, rather than trusting an
     * admin to remember on a Sunday night. Community Favourite is deliberately
     * outside this index: the brief only restricts the former.
     */
    uniqueIndex("creator_of_week_once_per_campaign")
      .on(t.campaignId, t.campaignCreatorId)
      .where(sql`category = 'creator_of_week'`),
    index("winners_published_idx").on(t.campaignId, t.publishedAt),
    check("winner_week_range", sql`${t.weekNo} BETWEEN 1 AND 4`),
    check("winner_prize_positive", sql`${t.prizeAmountNaira} > 0`),
  ],
);

/* ------------------------------------------------- community favourite vote */

export const voteRounds = pgTable(
  "vote_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    weekNo: smallint("week_no").notNull(),

    status: voteRoundStatusEnum("status").notNull().default("draft"),
    opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("one_round_per_week").on(t.campaignId, t.weekNo),
    check("round_window_ordered", sql`${t.closesAt} > ${t.opensAt}`),
    check("round_week_range", sql`${t.weekNo} BETWEEN 1 AND 4`),
  ],
);

/**
 * The shortlist. Nominates an ENTRY, not a submission — otherwise a creator who
 * posted on all three platforms appears on the ballot three times and splits
 * their own vote. Same grouping rule as the leaderboard, applied to voting.
 */
export const voteRoundNominees = pgTable(
  "vote_round_nominees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => voteRounds.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => challengeEntries.id, { onDelete: "cascade" }),
    displayOrder: smallint("display_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("nominee_unique_per_round").on(t.roundId, t.entryId),
    index("nominee_round_idx").on(t.roundId),
  ],
);

/**
 * ONE VOTE PER PERSON PER ROUND.
 *
 * The unique index is on a verified email, not on IP. IP-based uniqueness looks
 * rigorous and is actively harmful here: Nigerian mobile carriers NAT huge
 * numbers of subscribers behind a handful of addresses, so a per-IP cap
 * silently disenfranchises real voters while barely inconveniencing anyone with
 * a VPN. IP and user-agent are recorded as SIGNALS for the admin's
 * remove-suspicious-votes screen, never as the gate.
 *
 * The index is partial on status='counted' so that removing a fraudulent vote
 * frees that person to vote again legitimately if they were wrongly swept up.
 */
export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => voteRounds.id, { onDelete: "cascade" }),
    nomineeId: uuid("nominee_id")
      .notNull()
      .references(() => voteRoundNominees.id, { onDelete: "cascade" }),

    /** Canonicalised exactly like creators.emailCanonical. */
    voterEmailCanonical: text("voter_email_canonical").notNull(),
    /** Proof the address was reachable — unverified votes never count. */
    verifiedAt: timestamp("verified_at", { withTimezone: true }),

    status: voteStatusEnum("status").notNull().default("counted"),
    removedReason: text("removed_reason"),
    removedByAdminId: uuid("removed_by_admin_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),

    /** Signals for review, not gates. */
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    /** Cloudflare Turnstile verdict, if the token was checked server-side. */
    botCheckPassed: boolean("bot_check_passed").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("one_counted_vote_per_person_per_round")
      .on(t.roundId, t.voterEmailCanonical)
      .where(sql`status = 'counted'`),
    index("vote_tally_idx").on(t.nomineeId, t.status),
    index("vote_ip_review_idx").on(t.roundId, t.ipHash),
    check(
      "vote_removal_explained",
      sql`${t.status} = 'counted' OR ${t.removedReason} IS NOT NULL`,
    ),
  ],
);

/* ------------------------------------------------------- resources / pack */

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),

    /**
     * brand_assets | product_info | screenshots | faq | approved_claims |
     * messaging | rules | hashtags | handles | dos_and_donts |
     * prohibited_claims | announcement
     */
    section: text("section").notNull(),
    title: text("title").notNull(),
    /** Markdown, rendered server-side. */
    body: text("body"),
    /** External link (Drive, Figma) — no file storage in V1. */
    url: text("url"),

    displayOrder: smallint("display_order").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(false),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedByAdminId: uuid("updated_by_admin_id").references(
      () => adminUsers.id,
      { onDelete: "set null" },
    ),
  },
  (t) => [
    index("resources_section_idx").on(t.campaignId, t.section, t.displayOrder),
    check(
      "resource_has_content",
      sql`${t.body} IS NOT NULL OR ${t.url} IS NOT NULL`,
    ),
  ],
);

/* ------------------------------------------------------------ admin/audit */

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    emailCanonical: text("email_canonical").notNull(),
    /** scrypt or argon2id. Never a shared password. */
    passwordHash: text("password_hash").notNull(),
    role: adminRoleEnum("role").notNull().default("reviewer"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("admin_email_key").on(t.emailCanonical)],
);

/**
 * Every admin mutation that touches money, points or publication.
 *
 * `before`/`after` are whole-row JSON snapshots rather than a diff, because the
 * question asked six weeks from now ("why did this creator get 300 points for
 * a week they only posted twice in?") is answered by state, not by a delta.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),
    actorAdminId: uuid("actor_admin_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),

    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),

    before: jsonb("before"),
    after: jsonb("after"),
    note: text("note"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entityType, t.entityId, t.createdAt),
    index("audit_campaign_idx").on(t.campaignId, t.createdAt),
  ],
);

/**
 * Registration attempts, for rate limiting only.
 *
 * The per-address ceiling used to count rows in `creators`, which counted only
 * registrations that succeeded. Every rejected attempt was free, so the
 * duplicate-detection responses could be probed without limit to learn whether
 * a given email, phone or handle was already registered.
 *
 * Only the address and the outcome are kept. Recording which email was tried
 * would build a list of people who are not registered, which is a worse thing
 * to hold than the thing it is protecting.
 */
export const registrationAttempts = pgTable(
  "registration_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ip: text("ip"),
    outcome: text("outcome").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("registration_attempts_ip_time").on(t.ip, t.createdAt)],
);
