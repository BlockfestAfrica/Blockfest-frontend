import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { MONICA_SLUG } from "@/lib/campaigns";
import { remindersSent, waitingCount } from "@/lib/admin/reminders";
import { nextReminder, REMINDER_DUE_MS, type ReminderSent } from "@/lib/reminder-rules";
import { announcementSunday } from "@/lib/winner-weeks";
import { closesWhen, closingAt, dayDate } from "@/lib/format";

/**
 * What needs a person on the Monica campaign today.
 *
 * The owner asked for the campaign to be more proactive without anything
 * going to creators on a timer: every send to creators stays a button a
 * person presses. So this tells the team instead. Each morning a scheduled
 * function asks for this list, and owners get one email naming what is due,
 * each with the console link that does it; on a day with nothing due, no
 * email. It would have caught the stage 2 reminder going out on the morning
 * of a noon close rather than the evening before.
 *
 * dueItems is pure: the loader below reads the campaign's state, and the list
 * is decided from that and the time, so it can be tested at any moment.
 */

export interface DueItem {
  text: string;
  /** A console path, relative. */
  href: string;
}

export interface DueFacts {
  challenges: {
    id: string;
    weekNo: number;
    status: "draft" | "active" | "closed";
    startsAt: string;
    endsAt: string;
  }[];
  /** Challenge ids whose stage has been announced to creators. */
  announced: string[];
  /** Reminders sent, and creators still with nothing in, per open challenge. */
  reminders: Record<string, { sent: ReminderSent[]; waiting: number }>;
  /** Submissions pending review for over a day. */
  pendingOverADay: number;
  /** Weeks whose standings have been recorded. */
  recorded: number[];
  /** Published awards, as "week:category". */
  published: string[];
  rounds: {
    weekNo: number;
    status: "draft" | "open" | "closed" | "published";
    opensAt: string;
    closesAt: string;
    reviewed: boolean;
    told: boolean;
  }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const at = (iso: string) => new Date(iso).getTime();

export function dueItems(facts: DueFacts, now: number): DueItem[] {
  const items: DueItem[] = [];
  const stages = "/admin/campaign#stages";
  const winners = (week: number) => `/admin/winners?week=${week}`;

  for (const c of facts.challenges) {
    const open = c.status === "active" && at(c.startsAt) <= now && now < at(c.endsAt);
    if (!open) continue;

    if (!facts.announced.includes(c.id)) {
      items.push({
        text: `Announce week ${c.weekNo} to creators: it is live and nobody has been told.`,
        href: stages,
      });
    }

    const r = facts.reminders[c.id];
    const left = at(c.endsAt) - now;
    if (r && r.waiting > 0 && left <= REMINDER_DUE_MS) {
      const next = nextReminder(r.sent, now);
      if (next.ok) {
        const who = `${r.waiting} ${r.waiting === 1 ? "creator has" : "creators have"} nothing in`;
        items.push({
          text:
            next.number === 1
              ? `Send the week ${c.weekNo} reminder: it closes ${closesWhen(c.endsAt, new Date(now))}, and ${who}.`
              : `Send the week ${c.weekNo} last call: it closes ${closesWhen(c.endsAt, new Date(now))}, and ${who}.`,
          href: stages,
        });
      }
    }
  }

  if (facts.pendingOverADay > 0) {
    const n = facts.pendingOverADay;
    items.push({
      text: `${n} ${n === 1 ? "submission has" : "submissions have"} waited over a day for review.`,
      href: "/admin",
    });
  }

  /* Results for the stage that ended most recently, once its Sunday has
     come. Only that one, so an old week is not nagged about for ever. */
  const ended = facts.challenges
    .filter((c) => at(c.endsAt) <= now)
    .sort((a, b) => at(b.endsAt) - at(a.endsAt))[0];
  if (ended && now >= at(announcementSunday(ended.endsAt))) {
    const w = ended.weekNo;
    const round = facts.rounds.find((r) => r.weekNo === w && r.status !== "draft");
    /* A week's standings can only be recorded while it is the current
       stage (the snapshot route refuses any other), and announcing and the
       vote both need them. So on its Sunday say "today", and after that say
       once that it needs fixing rather than list three refused actions. */
    const started = facts.challenges.filter((c) => at(c.startsAt) <= now);
    const current = started.length ? started[started.length - 1].weekNo : 1;
    const recordable = w === current;
    const later = facts.challenges.some((c) => c.weekNo > w);
    const recorded = facts.recorded.includes(w);
    if (!recorded) {
      items.push({
        text: recordable
          ? later
            ? `Record the week ${w} standings today, before midnight: after that they cannot be recorded.`
            : `Record the week ${w} standings.`
          : `Week ${w}'s standings were never recorded, so its awards cannot be announced or voted on from the console. They need fixing by hand.`,
        href: winners(w),
      });
    }
    if (recorded || recordable) {
      if (!facts.published.includes(`${w}:creator_of_week`)) {
        items.push({ text: `Announce week ${w}'s Creator of the Week.`, href: winners(w) });
      }
      if (!round && !facts.published.includes(`${w}:community_favourite`)) {
        items.push({ text: `Open the week ${w} Community Favourite vote.`, href: winners(w) });
      }
    }
  }

  for (const r of facts.rounds) {
    if (facts.published.includes(`${r.weekNo}:community_favourite`)) continue;
    const running = r.status === "open" && at(r.opensAt) <= now && now < at(r.closesAt);
    const over = r.status === "closed" || (r.status === "open" && now >= at(r.closesAt));
    if (running && !r.told) {
      items.push({
        text: `Tell the creators the week ${r.weekNo} vote is open: it closes ${closingAt(r.closesAt)}.`,
        href: winners(r.weekNo),
      });
    }
    if (over) {
      items.push({
        text: r.reviewed
          ? `Announce the week ${r.weekNo} Community Favourite: the vote is reviewed.`
          : `Review the week ${r.weekNo} vote and announce the Community Favourite: voting has closed.`,
        href: winners(r.weekNo),
      });
    }
  }

  /* A stage starting within two days that is still a draft would open with
     nothing for creators to read; one already inside its window is worse,
     because nobody can enter it. */
  for (const c of facts.challenges) {
    if (c.status !== "draft") continue;
    const starts = at(c.startsAt);
    if (starts > now && starts - now <= 2 * DAY_MS) {
      items.push({
        text: `Week ${c.weekNo} starts ${dayDate(c.startsAt)} and is still a draft: write it and set it active.`,
        href: stages,
      });
    } else if (starts <= now && now < at(c.endsAt)) {
      items.push({
        text: `Week ${c.weekNo} started ${dayDate(c.startsAt)} and is still a draft, so creators cannot enter: set it active, then announce it.`,
        href: stages,
      });
    }
  }

  return items;
}

/** Reads what dueItems decides from. Owners and the scheduled job only. */
export async function loadDueFacts(): Promise<DueFacts> {
  const db = getDb();
  const iso = (value: unknown) => new Date(String(value)).toISOString();

  const [challenges, announced, pending, recorded, published, rounds] = await Promise.all([
    db.execute(sql`
      SELECT ch.id, ch.week_no, ch.status::text AS status, ch.starts_at, ch.ends_at
        FROM challenges ch JOIN campaigns c ON c.id = ch.campaign_id
       WHERE c.slug = ${MONICA_SLUG}
       ORDER BY ch.week_no
    `),
    db.execute(sql`
      SELECT DISTINCT a.entity_id FROM audit_log a
       WHERE a.action = 'challenge.announced' AND a.entity_type = 'challenge'
    `),
    db.execute(sql`
      SELECT count(*)::int AS n
        FROM submissions s
        JOIN challenge_entries ce ON ce.id = s.entry_id
        JOIN challenges ch        ON ch.id = ce.challenge_id
        JOIN campaigns c          ON c.id = ch.campaign_id
       WHERE c.slug = ${MONICA_SLUG}
         AND s.status = 'pending'
         AND s.submitted_at < now() - interval '1 day'
    `),
    db.execute(sql`
      SELECT DISTINCT s.week_no FROM leaderboard_snapshots s
        JOIN campaigns c ON c.id = s.campaign_id
       WHERE c.slug = ${MONICA_SLUG}
    `),
    db.execute(sql`
      SELECT w.week_no, w.category::text AS category FROM weekly_winners w
        JOIN campaigns c ON c.id = w.campaign_id
       WHERE c.slug = ${MONICA_SLUG} AND w.published_at IS NOT NULL
    `),
    db.execute(sql`
      SELECT r.id, r.week_no, r.status::text AS status, r.opens_at, r.closes_at,
             r.reviewed_at IS NOT NULL AS reviewed,
             EXISTS (SELECT 1 FROM audit_log a
                      WHERE a.action = 'vote.announced'
                        AND a.entity_type = 'vote_round'
                        AND a.entity_id = r.id) AS told
        FROM vote_rounds r JOIN campaigns c ON c.id = r.campaign_id
       WHERE c.slug = ${MONICA_SLUG}
    `),
  ]);

  const challengeRows = ((challenges.rows ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    weekNo: Number(r.week_no),
    status: String(r.status) as DueFacts["challenges"][number]["status"],
    startsAt: iso(r.starts_at),
    endsAt: iso(r.ends_at),
  }));

  /* Reminder state only for weeks taking entries now, the only ones a
     reminder can be sent for. */
  const now = Date.now();
  const open = challengeRows.filter(
    (c) => c.status === "active" && at(c.startsAt) <= now && now < at(c.endsAt),
  );
  const reminders: DueFacts["reminders"] = {};
  for (const c of open) {
    const [sent, waiting] = await Promise.all([remindersSent(c.id), waitingCount(c.id)]);
    reminders[c.id] = { sent, waiting };
  }

  return {
    challenges: challengeRows,
    announced: ((announced.rows ?? []) as { entity_id?: string }[]).map((r) => String(r.entity_id)),
    reminders,
    pendingOverADay: Number((pending.rows?.[0] as { n?: number } | undefined)?.n ?? 0),
    recorded: ((recorded.rows ?? []) as { week_no?: number }[]).map((r) => Number(r.week_no)),
    published: ((published.rows ?? []) as { week_no?: number; category?: string }[]).map(
      (r) => `${r.week_no}:${r.category}`,
    ),
    rounds: ((rounds.rows ?? []) as Record<string, unknown>[]).map((r) => ({
      weekNo: Number(r.week_no),
      status: String(r.status) as DueFacts["rounds"][number]["status"],
      opensAt: iso(r.opens_at),
      closesAt: iso(r.closes_at),
      reviewed: r.reviewed === true,
      told: r.told === true,
    })),
  };
}

/** The ledger action for the daily email, one row per Lagos day. */
export const DUE_TODAY_ACTION = "nudge.due-today";
