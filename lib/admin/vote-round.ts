import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { MONICA_SLUG } from "@/lib/campaigns";
import { ALLOWLISTED_DOMAINS } from "@/lib/campaign-vote";
import type { AdminIdentity } from "@/lib/admin/session";

/**
 * The Community Favourite round, read for the console.
 *
 * Takes an AdminIdentity, which nothing outside requireAdmin can construct, so
 * calling any of this from an unguarded route is a type error rather than an
 * incident. Same discipline as lib/admin/winners.ts, and for the same reason:
 * what these reads feed decides who is paid.
 *
 * Every rule about what counts lives in the 0046 SQL. This file only reads,
 * and the tally always goes through the vote_tally view, so no query here can
 * invent its own definition of a countable vote and quietly disagree with the
 * one the engine enforces.
 */

export type RoundStatus = "draft" | "open" | "closed" | "published";

export interface VoteRound {
  roundId: string;
  weekNo: number;
  status: RoundStatus;
  opensAt: Date;
  closesAt: Date;
  reviewedAt: Date | null;
}

export interface CandidateEntry {
  entryId: string;
  name: string;
  points: number;
  approvedPlatforms: number;
}

export interface NomineeTally {
  nomineeId: string;
  entryId: string;
  /** The creator behind the entry: what the announce step actually names. */
  enrolmentId: string;
  name: string;
  votes: number;
}

/**
 * One vote inside a cluster, carrying the id the remove action needs.
 *
 * The signal panels used to report only "this connection cast 18 votes" and
 * name no vote, so a reviewer who judged a cluster fraudulent had nothing to
 * click: the only ids the console ever rendered were the held ones, and the
 * domain cap holds nothing from gmail, yahoo or outlook. The engine always
 * accepted the removal. The screen simply never said which votes they were.
 */
export interface ClusterMember {
  voteId: string;
  email: string;
  createdAt: Date;
  /** True when the domain cap already held it, so it is not double listed. */
  held: boolean;
}

export interface DomainCluster {
  domain: string;
  votes: number;
  members: ClusterMember[];
}

export interface IpCluster {
  ipHash: string;
  votes: number;
  members: ClusterMember[];
}

export interface HeldVote {
  voteId: string;
  email: string;
  domain: string;
  createdAt: Date;
}

export interface RoundTally {
  nominees: NomineeTally[];
  domains: DomainCluster[];
  ips: IpCluster[];
  held: HeldVote[];
  unverified: number;
}

function asRoundStatus(value: unknown): RoundStatus {
  return value === "open" || value === "closed" || value === "published"
    ? value
    : "draft";
}

/** This week's round, if one has been opened. One per week by index. */
export async function currentRound(
  admin: AdminIdentity,
  weekNo: number,
): Promise<VoteRound | null> {
  void admin;
  const result = await getDb().execute(sql`
    SELECT r.id, r.week_no, r.status::text AS status,
           r.opens_at, r.closes_at, r.reviewed_at
      FROM vote_rounds r
      JOIN campaigns cm ON cm.id = r.campaign_id
     WHERE cm.slug = ${MONICA_SLUG}
       AND r.week_no = ${weekNo}
  `);

  const row = result.rows?.[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    roundId: String(row.id),
    weekNo: Number(row.week_no ?? 0),
    status: asRoundStatus(row.status),
    opensAt: new Date(String(row.opens_at)),
    closesAt: new Date(String(row.closes_at)),
    reviewedAt: row.reviewed_at ? new Date(String(row.reviewed_at)) : null,
  };
}

/**
 * Who may be put on the ballot: approved entries of this week's challenge.
 *
 * The same eligibility open_vote_round enforces, so a pick made from this list
 * cannot fail the engine's P0812 check, plus one narrowing the engine leaves
 * to the announce gate: a voided creator is omitted here, because a name that
 * cannot be published on Sunday has no business collecting votes on Sunday
 * morning.
 */
export async function candidateEntries(
  admin: AdminIdentity,
  weekNo: number,
): Promise<CandidateEntry[]> {
  void admin;
  const result = await getDb().execute(sql`
    SELECT e.id, c.full_name, e.awarded_points, e.approved_platform_count
      FROM challenge_entries e
      JOIN challenges ch         ON ch.id = e.challenge_id
      JOIN campaigns cm          ON cm.id = ch.campaign_id
      JOIN campaign_creators cc  ON cc.id = e.campaign_creator_id
      JOIN creators c            ON c.id = cc.creator_id
     WHERE cm.slug = ${MONICA_SLUG}
       AND ch.week_no = ${weekNo}
       AND e.approved_platform_count >= 1
       AND cc.status = 'active'
     ORDER BY e.awarded_points DESC, c.full_name ASC
  `);

  return (result.rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      entryId: String(r.id),
      name: String(r.full_name ?? "").trim(),
      points: Number(r.awarded_points ?? 0),
      approvedPlatforms: Number(r.approved_platform_count ?? 0),
    };
  });
}

/**
 * Domain clusters worth a human's attention.
 *
 * The big consumer providers are exempt from the cap in the engine, and for
 * the same reason they are noise here: two hundred gmail.com votes is a
 * campaign working, twelve from one company domain is a Slack channel and
 * forty from one catch-all is a farm. Pure, and exported, so the exclusion
 * can be tested without a database.
 */
export function withoutAllowlistedDomains<T extends { domain: string }>(
  clusters: T[],
  allowlist: Iterable<string>,
): T[] {
  const exempt = new Set(
    Array.from(allowlist, (domain) => domain.toLowerCase()),
  );
  return clusters.filter(
    (cluster) => !exempt.has(cluster.domain.toLowerCase()),
  );
}

/**
 * The round as the reviewer needs to see it: the tally, and the signals the
 * sweep is made of.
 *
 * The cluster queries read verified, counted votes and deliberately include
 * held ones: a held vote is parked, not judged, and a reviewer deciding what
 * to do with a cluster needs to see the whole cluster, not the part of it
 * that slipped under the cap. Unverified casts count nothing and appear only
 * as their total, which is itself a signal when it is large.
 */
/**
 * json_agg gives back whatever the driver decided: already-parsed rows on one
 * path, a JSON string on another. Both are handled rather than assumed,
 * because a reviewer staring at a cluster they cannot act on is the exact
 * failure this whole change exists to remove, and a thrown parse here would
 * reproduce it silently.
 */
export function readMembers(raw: unknown): ClusterMember[] {
  let rows: unknown = raw;
  if (typeof raw === "string") {
    try {
      rows = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const r = row as Record<string, unknown> | null;
    if (!r?.voteId) return [];
    const at = new Date(String(r.createdAt ?? ""));
    return [
      {
        voteId: String(r.voteId),
        email: String(r.email ?? ""),
        createdAt: Number.isNaN(at.getTime()) ? new Date(0) : at,
        held: Boolean(r.held),
      },
    ];
  });
}

export async function roundTally(
  admin: AdminIdentity,
  roundId: string,
): Promise<RoundTally> {
  void admin;
  const db = getDb();

  const [nominees, domains, ips, held, unverified] = await Promise.all([
    db.execute(sql`
      SELECT t.nominee_id, t.entry_id, t.votes, c.full_name,
             cc.id AS enrolment_id
        FROM vote_tally t
        JOIN vote_round_nominees n ON n.id = t.nominee_id
        JOIN challenge_entries e   ON e.id = t.entry_id
        JOIN campaign_creators cc  ON cc.id = e.campaign_creator_id
        JOIN creators c            ON c.id = cc.creator_id
       WHERE t.round_id = ${roundId}
       ORDER BY t.votes DESC, n.display_order ASC
    `),
    db.execute(sql`
      SELECT split_part(v.voter_email_canonical, '@', 2) AS domain,
             count(*)::int AS votes,
             json_agg(json_build_object(
               'voteId', v.id,
               'email', v.voter_email_canonical,
               'createdAt', v.created_at,
               'held', v.held_at IS NOT NULL
             ) ORDER BY v.created_at) AS members
        FROM votes v
       WHERE v.round_id = ${roundId}
         AND v.status = 'counted'
         AND v.verified_at IS NOT NULL
       GROUP BY 1
       ORDER BY votes DESC, domain ASC
    `),
    db.execute(sql`
      SELECT v.ip_hash, count(*)::int AS votes,
             json_agg(json_build_object(
               'voteId', v.id,
               'email', v.voter_email_canonical,
               'createdAt', v.created_at,
               'held', v.held_at IS NOT NULL
             ) ORDER BY v.created_at) AS members
        FROM votes v
       WHERE v.round_id = ${roundId}
         AND v.status = 'counted'
         AND v.verified_at IS NOT NULL
         AND v.ip_hash IS NOT NULL
       GROUP BY v.ip_hash
      HAVING count(*) >= 3
       ORDER BY votes DESC
    `),
    db.execute(sql`
      SELECT v.id, v.voter_email_canonical,
             split_part(v.voter_email_canonical, '@', 2) AS domain,
             v.created_at
        FROM votes v
       WHERE v.round_id = ${roundId}
         AND v.status = 'counted'
         AND v.held_at IS NOT NULL
       ORDER BY v.created_at ASC
    `),
    db.execute(sql`
      SELECT count(*)::int AS unverified
        FROM votes v
       WHERE v.round_id = ${roundId}
         AND v.status = 'counted'
         AND v.verified_at IS NULL
    `),
  ]);

  return {
    nominees: (nominees.rows ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        nomineeId: String(r.nominee_id),
        entryId: String(r.entry_id),
        enrolmentId: String(r.enrolment_id),
        name: String(r.full_name ?? "").trim(),
        votes: Number(r.votes ?? 0),
      };
    }),
    domains: withoutAllowlistedDomains(
      (domains.rows ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          domain: String(r.domain ?? ""),
          votes: Number(r.votes ?? 0),
          members: readMembers(r.members),
        };
      }),
      ALLOWLISTED_DOMAINS,
    ),
    ips: (ips.rows ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        ipHash: String(r.ip_hash ?? ""),
        votes: Number(r.votes ?? 0),
        members: readMembers(r.members),
      };
    }),
    held: (held.rows ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        voteId: String(r.id),
        email: String(r.voter_email_canonical ?? ""),
        domain: String(r.domain ?? ""),
        createdAt: new Date(String(r.created_at)),
      };
    }),
    unverified: Number(
      (unverified.rows?.[0] as Record<string, unknown> | undefined)
        ?.unverified ?? 0,
    ),
  };
}

/**
 * The votes one exact address cast in one round.
 *
 * The cluster panels answer "who is suspicious"; this answers "where is the
 * vote I already know about". Two cases need it and neither reaches a
 * cluster: the rehearsal vote the runbook tells the owner to cast and then
 * remove, which comes from a consumer inbox and so is filtered out of the
 * domain list entirely, and a vote somebody reports to us by name.
 *
 * Exact match only, and scoped to one round. A prefix or partial search here
 * would turn an owner-only console into a way to ask which addresses voted,
 * and the answer to that question is nobody's business including ours.
 */
export async function findVotesByEmail(
  roundId: string,
  email: string,
): Promise<ClusterMember[]> {
  const canonical = email.trim().toLowerCase();
  if (!canonical) return [];
  const found = await getDb().execute(sql`
    SELECT v.id, v.voter_email_canonical, v.created_at,
           v.held_at IS NOT NULL AS held
      FROM votes v
     WHERE v.round_id = ${roundId}::uuid
       AND v.status = 'counted'
       AND v.voter_email_canonical = ${canonical}
     ORDER BY v.created_at ASC
  `);
  return (found.rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const at = new Date(String(r.created_at ?? ""));
    return {
      voteId: String(r.id),
      email: String(r.voter_email_canonical ?? ""),
      createdAt: Number.isNaN(at.getTime()) ? new Date(0) : at,
      held: Boolean(r.held),
    };
  });
}
