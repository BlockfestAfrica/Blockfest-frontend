/**
 * How the deadline reminder may be sent, shared by the route that refuses
 * and the console that offers, so the two cannot disagree.
 *
 * Two per stage. One went out on the morning of the stage 2 close, and a
 * creator who read it after noon missed the stage: one reminder that close
 * to a midday deadline leaves no room for anybody who checks mail later in
 * the day. So a reminder the evening before, and a last call on the morning.
 *
 * The second only some hours after the first, so two owners pressing in the
 * same hour, or one pressing twice, cannot send the same creators two
 * reminders back to back. It goes to whoever still has nothing in by then.
 */
export const REMINDERS_PER_STAGE = 2;

/** Hours between the first reminder and the last call. */
export const REMINDER_GAP_MS = 6 * 60 * 60 * 1000;

/** The day and a half before a close, when the card asks for a reminder. */
export const REMINDER_DUE_MS = 36 * 60 * 60 * 1000;

/** A reminder already sent for a stage, oldest first. */
export interface ReminderSent {
  /** 1 for the first, 2 for the last call. */
  number: number;
  at: string;
  sent: number;
  failed: number;
  finished: boolean;
}

/**
 * Whether another reminder may go now, and if not, why. The route says the
 * reason; the console hides the button and says when it can go.
 */
export function nextReminder(
  sent: ReminderSent[],
  now: number,
): { ok: true; number: number } | { ok: false; reason: "all-sent" | "too-soon" | "unfinished"; at?: number } {
  if (sent.length >= REMINDERS_PER_STAGE) return { ok: false, reason: "all-sent" };
  const last = sent[sent.length - 1];
  if (!last) return { ok: true, number: 1 };
  if (!last.finished) return { ok: false, reason: "unfinished" };
  const allowed = new Date(last.at).getTime() + REMINDER_GAP_MS;
  if (now < allowed) return { ok: false, reason: "too-soon", at: allowed };
  return { ok: true, number: sent.length + 1 };
}
