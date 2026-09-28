import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { CAMPAIGN_PLATFORMS, MONICA_SLUG, type CampaignPlatform } from "@/lib/campaigns";
import { ALLOWLISTED_DOMAINS, isNeverBlock } from "@/lib/campaign-vote";
import { registrableDomain, voteDomainKey, type MxKind } from "@/lib/vote-domain";
import {
  autoEvidenceSentence,
  isProtectedDomain,
  type HeldReason,
} from "@/lib/vote-domain-copy";
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
  /**
   * When "Tell the creators" was pressed for this round, read from its audit
   * row, which is the send's ledger. The console used to remember a send
   * only until the page reloaded, so the button came back on a vote whose
   * email had already gone out.
   */
  announced: { at: Date; finished: boolean; sent: number | null; failed: number | null } | null;
}

/** One approved post of a nominee's entry, and the account it was filed under. */
export interface CandidatePost {
  platform: CampaignPlatform;
  /** The handle the creator registered for that platform, if any. */
  handle: string | null;
  url: string;
}

export interface CandidateEntry {
  entryId: string;
  name: string;
  points: number;
  approvedPlatforms: number;
  /** Approved posts, one per platform, in the campaign's platform order. */
  posts: CandidatePost[];
}

/** Rebuilt field by field; a json column arrives parsed or as text. */
function toPosts(value: unknown): CandidatePost[] {
  let list: unknown = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const posts: CandidatePost[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const { platform, handle, url } = item as Record<string, unknown>;
    if (!(CAMPAIGN_PLATFORMS as readonly unknown[]).includes(platform)) continue;
    if (typeof url !== "string" || url === "") continue;
    posts.push({
      platform: platform as CampaignPlatform,
      handle: typeof handle === "string" && handle.trim() ? handle.trim() : null,
      url,
    });
  }
  return posts.sort(
    (a, b) => CAMPAIGN_PLATFORMS.indexOf(a.platform) - CAMPAIGN_PLATFORMS.indexOf(b.platform),
  );
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

/** One host inside a domain cluster, and how many of its votes are there. */
export interface DomainHost {
  host: string;
  votes: number;
}

export interface DomainCluster {
  /** The registrable domain the cap judges these votes under. */
  domain: string;
  votes: number;
  members: ClusterMember[];
  /**
   * The hosts the votes came from, most votes first. One entry, equal to the
   * domain, for an ordinary cluster; several when a farm spread itself over
   * subdomains, which is exactly what the reviewer needs to see.
   */
  hosts: DomainHost[];
  /**
   * How many of those votes have a local part that looks machine-made
   * (vote_local_looks_generated in 0069): letters only, eight or more, and
   * under a quarter vowels. A signal for the reviewer, never a verdict.
   */
  machineMade: number;
}

export type BlockSource = "admin" | "auto";

/** A cluster as the console shows it: the votes, and what can be done. */
export interface DomainClusterView extends DomainCluster {
  /** An active block on this domain, by an owner or by the automatic rule. */
  block: BlockSource | null;
  /**
   * Whether Block and Remove all may be offered. Not for a never-block
   * provider, and not for a host with no registrable domain (an IP address
   * or a bare suffix), which a block would have to guess at.
   */
  blockable: boolean;
  /** A school or government domain, which the dialogs warn about. */
  protectedDomain: boolean;
  /**
   * What the domain's mail host was classified as when a code was cast
   * (vote_domain_mx), or null when it never was: a consumer provider, a
   * school or government domain, or a domain nobody has cast from since
   * 0069. The console tags a forwarding service, which is what the incident
   * farm was.
   */
  mxKind: MxKind | null;
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
  /** Why it waits: the cap, a blocked domain, or a forwarding service. */
  reason: HeldReason;
}

export interface RoundTally {
  nominees: NomineeTally[];
  domains: DomainClusterView[];
  ips: IpCluster[];
  held: HeldVote[];
  unverified: number;
}

function asHeldReason(value: unknown): HeldReason {
  return value === "cap" || value === "blocked" || value === "forwarder"
    ? value
    : null;
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
           r.opens_at, r.closes_at, r.reviewed_at,
           told.created_at          AS told_at,
           told.after->>'status'    AS told_status,
           told.after->>'sent'      AS told_sent,
           told.after->>'failed'    AS told_failed
      FROM vote_rounds r
      JOIN campaigns cm ON cm.id = r.campaign_id
      LEFT JOIN LATERAL (
            SELECT a.created_at, a.after
              FROM audit_log a
             WHERE a.action = 'vote.announced'
               AND a.entity_type = 'vote_round'
               AND a.entity_id = r.id
             ORDER BY a.created_at
             LIMIT 1
      ) told ON true
     WHERE cm.slug = ${MONICA_SLUG}
       AND r.week_no = ${weekNo}
  `);

  const row = result.rows?.[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  // after->> hands back text, or NULL for a key the row never had.
  const whole = (value: unknown) => {
    const n = Number(value);
    return value == null || Number.isNaN(n) ? null : n;
  };
  return {
    roundId: String(row.id),
    weekNo: Number(row.week_no ?? 0),
    status: asRoundStatus(row.status),
    opensAt: new Date(String(row.opens_at)),
    closesAt: new Date(String(row.closes_at)),
    reviewedAt: row.reviewed_at ? new Date(String(row.reviewed_at)) : null,
    announced: row.told_at
      ? {
          at: new Date(String(row.told_at)),
          finished: row.told_status === "finished",
          sent: whole(row.told_sent),
          failed: whole(row.told_failed),
        }
      : null,
  };
}

/**
 * The most recent week before `beforeWeek` whose vote is not finished: still
 * open, or closed but its Community Favourite not yet announced (announcing
 * marks the round published).
 *
 * The winners screen used to follow the calendar alone, so a vote that ran
 * past the start of the next stage (a 48-hour vote opened on the Sunday
 * closes on the Tuesday) vanished from it at midnight on the Monday, with the
 * close, the review and the announce still to do.
 */
export async function unfinishedVoteWeek(
  admin: AdminIdentity,
  beforeWeek: number,
): Promise<number | null> {
  void admin;
  const result = await getDb().execute(sql`
    SELECT r.week_no
      FROM vote_rounds r
      JOIN campaigns cm ON cm.id = r.campaign_id
     WHERE cm.slug = ${MONICA_SLUG}
       AND r.week_no < ${beforeWeek}
       AND r.status IN ('open', 'closed')
     ORDER BY r.week_no DESC
     LIMIT 1
  `);
  const row = result.rows?.[0] as { week_no?: unknown } | undefined;
  return row ? Number(row.week_no) : null;
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
  /*
   * With each approved post and the handle the creator registered on that
   * platform. Names alone were not enough to tell nominees apart on the
   * ballot: two creators can share a name, and the handle is what the
   * reviewers already know them by.
   */
  const result = await getDb().execute(sql`
    SELECT e.id, c.full_name, e.awarded_points, e.approved_platform_count,
           COALESCE((
             SELECT json_agg(json_build_object(
                      'platform', s.platform, 'url', s.url, 'handle', h.handle)
                    ORDER BY s.platform)
               FROM submissions s
               LEFT JOIN creator_social_handles h
                      ON h.creator_id = c.id AND h.platform = s.platform
              WHERE s.entry_id = e.id AND s.status = 'approved'
           ), '[]'::json) AS approved_posts
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
      posts: toPosts(r.approved_posts),
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
 * Per-host clusters folded into one cluster per registrable domain.
 *
 * The query groups by the full host because SQL has no public suffix list.
 * Left like that, a farm spread over a.oemails.com, b.oemails.com and
 * c.oemails.com showed as three small clusters (paged under "Show more" once
 * there were enough of them), while the cap judged them as one domain with
 * one allowance (0069). Folding them here keys the console on the same
 * domain as the cap and "Remove all", so the number on the row is the number
 * the removal takes. Pure, and exported, so it can be tested without a
 * database.
 */
export function groupByVoteDomain(
  clusters: {
    domain: string;
    votes: number;
    members: ClusterMember[];
    machineMade?: number;
  }[],
): DomainCluster[] {
  const grouped = new Map<string, DomainCluster>();
  for (const cluster of clusters) {
    const key = voteDomainKey(cluster.domain);
    const into = grouped.get(key) ?? {
      domain: key,
      votes: 0,
      members: [],
      hosts: [],
      machineMade: 0,
    };
    into.votes += cluster.votes;
    into.machineMade += cluster.machineMade ?? 0;
    into.members.push(...cluster.members);
    const host = into.hosts.find((h) => h.host === cluster.domain);
    if (host) host.votes += cluster.votes;
    else into.hosts.push({ host: cluster.domain, votes: cluster.votes });
    grouped.set(key, into);
  }

  const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return [...grouped.values()]
    .map((cluster) => ({
      ...cluster,
      members: [...cluster.members].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      ),
      hosts: [...cluster.hosts].sort(
        (a, b) => b.votes - a.votes || byName(a.host, b.host),
      ),
    }))
    .sort((a, b) => b.votes - a.votes || byName(a.domain, b.domain));
}

/**
 * Each cluster with what the console may offer on it: whether an active block
 * already covers it, whether it can be blocked at all, and whether it is a
 * school or government domain the dialogs should warn about.
 *
 * A block covers its domain and every subdomain, so a cluster keyed on
 * oemails.com is covered by a block on oemails.com, and one on a stray
 * subdomain host by a block on its parent. An owner's block wins over an
 * automatic one when both cover a cluster, because the pill should say who
 * decided. Pure, and exported, so it can be tested without a database.
 */
export function withDomainState<T extends { domain: string }>(
  clusters: T[],
  blocks: { domain: string; source: BlockSource }[],
  mailHosts: { domain: string; kind: MxKind }[] = [],
): (T & {
  block: BlockSource | null;
  blockable: boolean;
  protectedDomain: boolean;
  mxKind: MxKind | null;
})[] {
  /*
   * Mail hosts are cached under the registrable domain, the same key a
   * cluster carries, so this is an exact match.
   */
  const kinds = new Map(mailHosts.map((m) => [m.domain.toLowerCase(), m.kind]));
  return clusters.map((cluster) => {
    const domain = cluster.domain.toLowerCase();
    const covering = blocks.filter(
      (b) => domain === b.domain || domain.endsWith(`.${b.domain}`),
    );
    const block = covering.some((b) => b.source === "admin")
      ? "admin"
      : covering.length > 0
        ? "auto"
        : null;
    return {
      ...cluster,
      block,
      blockable: registrableDomain(domain) !== null && !isNeverBlock(domain),
      protectedDomain: isProtectedDomain(domain),
      mxKind: kinds.get(domain) ?? null,
    };
  });
}

function asMxKind(value: unknown): MxKind | null {
  return value === "forwarder" || value === "major" || value === "other" || value === "unknown"
    ? value
    : null;
}

/**
 * The cached mail-host kind of each cluster's domain. A second read, after the
 * clusters are grouped, because the key they are grouped by comes from the
 * public suffix list in Node; one indexed lookup per domain on the screen.
 */
async function mailHostKinds(domains: string[]): Promise<{ domain: string; kind: MxKind }[]> {
  if (domains.length === 0) return [];
  const list = sql.join(
    domains.map((domain) => sql`${domain}`),
    sql`, `,
  );
  const result = await getDb().execute(sql`
    SELECT domain, kind
      FROM vote_domain_mx
     WHERE domain = ANY (ARRAY[${list}]::text[])
  `);
  return (result.rows ?? []).flatMap((row) => {
    const r = row as Record<string, unknown>;
    const kind = asMxKind(r.kind);
    return kind ? [{ domain: String(r.domain ?? ""), kind }] : [];
  });
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

  const [nominees, domains, ips, held, unverified, blocks] = await Promise.all([
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
             count(*) FILTER (
               WHERE vote_local_looks_generated(split_part(v.voter_email_canonical, '@', 1))
             )::int AS machine_made,
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
             v.created_at, v.held_reason
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
    db.execute(sql`
      SELECT b.domain, b.source
        FROM vote_blocked_domains b
        JOIN vote_rounds r ON r.campaign_id = b.campaign_id
       WHERE r.id = ${roundId}
         AND b.lifted_at IS NULL
    `),
  ]);

  const clusters = withoutAllowlistedDomains(
    groupByVoteDomain(
      (domains.rows ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          domain: String(r.domain ?? ""),
          votes: Number(r.votes ?? 0),
          members: readMembers(r.members),
          machineMade: Number(r.machine_made ?? 0),
        };
      }),
    ),
    ALLOWLISTED_DOMAINS,
  );
  const mailHosts = await mailHostKinds(clusters.map((c) => c.domain));

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
    domains: withDomainState(
      clusters,
      (blocks.rows ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          domain: String(r.domain ?? ""),
          source: r.source === "auto" ? ("auto" as const) : ("admin" as const),
        };
      }),
      mailHosts,
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
        reason: asHeldReason(r.held_reason),
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

/** An active block, as the Blocked domains card shows it. */
export interface BlockedDomain {
  domain: string;
  source: BlockSource;
  reason: string;
  /** The automatic rule's evidence as one sentence, or null for an owner's block. */
  evidence: string | null;
  createdAt: Date;
  /** Who blocked it, for an owner's block; null for an automatic one. */
  createdByAdminId: string | null;
  createdByEmail: string | null;
  /**
   * Votes the block (or the forwarding rule) holds in rounds nobody has
   * reviewed: what an unblock would release, up to the domain's ten a
   * round; the rest stay held as over the ten.
   */
  held: number;
}

/**
 * Every active block on the campaign, newest first.
 *
 * Lifted blocks are left out: the row stays in the table as the record, and
 * the audit log says who lifted it and why, but the card is for what is in
 * force now.
 */
export async function blockedDomains(admin: AdminIdentity): Promise<BlockedDomain[]> {
  void admin;
  const result = await getDb().execute(sql`
    SELECT b.domain, b.source, b.reason, b.evidence, b.created_at,
           b.created_by_admin_id, a.email AS created_by_email,
           (SELECT count(*)::int
              FROM votes v
              JOIN vote_rounds r ON r.id = v.round_id
             WHERE r.campaign_id = b.campaign_id
               AND r.reviewed_at IS NULL
               AND r.status <> 'published'
               AND v.status = 'counted'
               AND v.held_at IS NOT NULL
               AND v.held_reason IN ('blocked', 'forwarder')
               AND vote_domain_matches(split_part(v.voter_email_canonical, '@', 2), b.domain)
           ) AS held
      FROM vote_blocked_domains b
      JOIN campaigns cm      ON cm.id = b.campaign_id
      LEFT JOIN admin_users a ON a.id = b.created_by_admin_id
     WHERE cm.slug = ${MONICA_SLUG}
       AND b.lifted_at IS NULL
     ORDER BY b.created_at DESC, b.domain ASC
  `);

  return (result.rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    let evidence: unknown = r.evidence;
    if (typeof evidence === "string") {
      try {
        evidence = JSON.parse(evidence);
      } catch {
        evidence = null;
      }
    }
    const source: BlockSource = r.source === "auto" ? "auto" : "admin";
    return {
      domain: String(r.domain ?? ""),
      source,
      reason: String(r.reason ?? ""),
      evidence: source === "auto" ? autoEvidenceSentence(evidence) : null,
      createdAt: new Date(String(r.created_at)),
      createdByAdminId: r.created_by_admin_id ? String(r.created_by_admin_id) : null,
      createdByEmail: r.created_by_email ? String(r.created_by_email) : null,
      held: Number(r.held ?? 0),
    };
  });
}
