import { currentWeekNo, monicaStages } from "@/lib/campaigns";
import { closingAt } from "@/lib/format";

/**
 * When a week's Community Favourite vote may be opened.
 *
 * On its results Sunday, while the week is still the current one. And once
 * more, late: stage 2's vote was not opened on its Sunday because the owner
 * opening it was away, and on the Monday the console had hidden the form,
 * because the week was over. Nothing on the server refused it; only the page.
 * So the week that has just ended can still have its vote opened, until the
 * stage after it closes, provided:
 *
 * - its standings are recorded. Closing a vote needs them (P0804), the
 *   console can only record the current week, and a round can never be
 *   cancelled, so a late vote without them would be stuck open for good;
 * - its Community Favourite is not already announced (the vote would decide
 *   nothing: a published winner cannot change);
 * - it closes by the time the following stage closes, so it is finished
 *   before that week's own vote, and the public ballot never has two open.
 *
 * Plain module, no "use client" and no "server-only": the winners page, the
 * vote panel, the vote route and the morning email all ask this one question,
 * so the console never offers what the route refuses, and the email never
 * asks for what the console hides. A week with no round yet is assumed; the
 * one-round-per-week index refuses a second either way.
 */

export type VoteOpening =
  | { open: true; /** ISO. A late vote must close by this; null on its own Sunday. */ closeBy: string | null }
  | { open: false; reason: string };

export function voteOpening({
  weekNo,
  now,
  recorded,
  favouriteAnnounced,
}: {
  weekNo: number;
  now: Date;
  /** Whether the week's standings have been recorded. */
  recorded: boolean;
  /** Whether the week's Community Favourite is already announced. */
  favouriteAnnounced: boolean;
}): VoteOpening {
  const current = currentWeekNo(now);
  if (weekNo > current) return { open: false, reason: `Week ${weekNo} has not started yet.` };
  if (weekNo === current) return { open: true, closeBy: null };

  const next = monicaStages.find((stage) => stage.number === weekNo + 1);
  if (weekNo !== current - 1 || !next || now.getTime() >= new Date(next.endsAt).getTime()) {
    return {
      open: false,
      reason: next
        ? `A missed vote can be opened until the stage after it closes, and stage ${next.number} closed ${closingAt(next.endsAt)}.`
        : "A missed vote can be opened until the stage after it closes.",
    };
  }
  if (!recorded) {
    return {
      open: false,
      reason: `Its standings were never recorded, and closing a vote needs them, so a vote opened now could never be closed or announced.`,
    };
  }
  if (favouriteAnnounced) {
    return { open: false, reason: `Week ${weekNo}'s Community Favourite is already announced.` };
  }
  return { open: true, closeBy: next.endsAt };
}

/** Why a late vote's close is too late. */
export const lateCloseSentence = (weekNo: number, closeBy: string) =>
  `A late week ${weekNo} vote has to close by ${closingAt(closeBy)}, when stage ${weekNo + 1} closes, so it is finished before week ${weekNo + 1}'s own vote.`;

/**
 * The route's check before a round is opened: null to go ahead, or the
 * sentence that says why not. On top of voteOpening, the close: not already
 * past, a late vote's by its deadline, and any vote that closes after the
 * next stage starts needs the week recorded first. The form has always
 * applied the first and the last; the route now applies all three.
 */
export function openRefusal(args: {
  weekNo: number;
  now: Date;
  recorded: boolean;
  favouriteAnnounced: boolean;
  closesAt: Date;
}): string | null {
  const opening = voteOpening(args);
  if (!opening.open) {
    return args.weekNo < currentWeekNo(args.now)
      ? `Week ${args.weekNo}'s vote cannot be opened now. ${opening.reason}`
      : opening.reason;
  }
  // The form says this too; a round can never be deleted, so the route does.
  if (args.closesAt.getTime() <= args.now.getTime()) return "The close time has already passed.";
  if (opening.closeBy && args.closesAt.getTime() > new Date(opening.closeBy).getTime()) {
    return lateCloseSentence(args.weekNo, opening.closeBy);
  }
  const next = monicaStages.find((stage) => stage.number === args.weekNo + 1);
  if (!args.recorded && next && args.closesAt.getTime() > new Date(next.startsAt).getTime()) {
    return `Record the week ${args.weekNo} standings first: this vote closes after stage ${args.weekNo + 1} starts, and closing it needs them.`;
  }
  return null;
}
