"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, HeartHandshake, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  buttonClass,
  control,
  Field,
  JobCard,
  Pill,
  Segmented,
} from "@/components/shared/panel";
import { CreatorPicker } from "@/components/admin/creator-picker";
import { Confirm } from "@/components/shared/confirm";
import { ActionDialog } from "@/components/shared/action-dialog";
import { naira } from "@/lib/format";
import { monicaWeeklyPrizes } from "@/lib/campaigns";

export interface CandidateRow {
  enrolmentId: string;
  name: string;
  points: number;
  rank: number;
}

/**
 * What the week's vote has settled, computed by the page from the same
 * tally the round card shows. The SQL is the authority either way: with a
 * reviewed round, publish_weekly_winner refuses any name but the vote's
 * winner, so this exists to show the answer rather than ask for one.
 */
export interface VoteVerdict {
  /** pending: round open or review incomplete. decided: a winner exists.
      zero: closed and reviewed with no countable votes. */
  state: "pending" | "decided" | "zero" | "tied";
  /** Votes the leaders hold. Zero only when nobody voted. */
  votes?: number;
  winner: { enrolmentId: string; name: string; votes: number } | null;
  /** The shortlist, for the zero-vote fallback where only nominees may win. */
  nomineeEnrolmentIds: string[];
}

export interface PickedRow {
  weekNo: number;
  category: "creator_of_week" | "community_favourite";
  enrolmentId: string;
  name: string;
  prizeNaira: number;
  note: string | null;
  publishedAt: string | null;
}

const CATEGORY_LABEL = {
  creator_of_week: "Creator of the Week",
  community_favourite: "Community Favourite",
} as const;

/* The advertised amount per category. The API refuses any other figure, so
   the box arrives filled with the only number it will accept. */
const CATEGORY_PRIZE: Record<keyof typeof CATEGORY_LABEL, number> =
  Object.fromEntries(
    monicaWeeklyPrizes.map((prize) => [
      prize.label === "Creator of the Week"
        ? "creator_of_week"
        : "community_favourite",
      prize.amount,
    ]),
  ) as Record<keyof typeof CATEGORY_LABEL, number>;

type Category = keyof typeof CATEGORY_LABEL;

/* What the confirmation shows is what gets sent: the modal reads this
   snapshot, taken when the button was pressed, and the request posts it. */
interface Pending {
  publish: boolean;
  category: Category;
  enrolmentId: string;
  name: string;
  prizeNaira: number;
  note: string;
}

const CATEGORY_ICON = {
  creator_of_week: Trophy,
  community_favourite: HeartHandshake,
} as const;

/* How each prize is decided, said in the modal so the reminder is about the
   award and not only its name, which is the part that gets confused. */
const CATEGORY_DECIDED_BY = {
  creator_of_week: "the Blockfest team's pick",
  community_favourite: "the prize the public vote decides",
} as const;

/* The award as a sentence names it: "the Community Favourite", but plain
   "Creator of the Week", as the rules and the public page say it. */
const CATEGORY_IN_A_SENTENCE = {
  creator_of_week: "Creator of the Week",
  community_favourite: "the Community Favourite",
} as const;

const OTHER_CATEGORY = {
  creator_of_week: "community_favourite",
  community_favourite: "creator_of_week",
} as const;

/**
 * The weekly ritual, as two jobs rather than eleven blocks.
 *
 * This screen was a flat run of headings, paragraphs, chips, selects, inputs and
 * buttons, all sitting directly on the page background at the same weight, with
 * the grouping asserted by a single larger margin partway down. The reader was
 * asked to infer which of the last six blocks belonged to which of the two
 * headings, by remembering a gap.
 *
 * It is two jobs: freeze the standings on Saturday, announce the winners on
 * Sunday. Each is an object with a name, a state on its edge, and a foot
 * containing the control that performs it. JobCard renders that object as a
 * contained hairline card since the console relayout, so the two jobs read
 * as two things on the page rather than a run of text.
 */
export function WinnersPanel({
  weekNo,
  creatorCandidates,
  favouriteCandidates,
  picked,
  frozen,
  canRecord = true,
  vote,
}: {
  weekNo: number;
  creatorCandidates: CandidateRow[];
  favouriteCandidates: CandidateRow[];
  picked: PickedRow[];
  /** Whether this week's standings have been recorded yet. */
  frozen: boolean;
  /**
   * The standings can only be recorded for the current stage (the snapshot
   * route refuses any other week), so a past week shows why, not a button.
   */
  canRecord?: boolean;
  /** Null when the week has no on-site round (the social-poll fallback). */
  vote: VoteVerdict | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<Category>("creator_of_week");
  const [enrolmentId, setEnrolmentId] = useState("");
  const [prize, setPrize] = useState(String(CATEGORY_PRIZE.creator_of_week));
  const [note, setNote] = useState("");
  /*
   * The act being confirmed. Owner ask: no admin should announce or draft
   * the wrong award by mistake, so Save as draft and Announce both stop on
   * a modal that names the award first, then the week, the creator and the
   * prize, and says which award this is not.
   */
  const [pending, setPending] = useState<Pending | null>(null);
  const [checked, setChecked] = useState(false);

  /*
   * The vote's verdict shapes the Community Favourite half of this card.
   * With a decided round the picker disappears: the engine refuses any
   * other name (P0806), so a dropdown here would only be a menu of
   * errors. A pending round blocks announcing until the review is done,
   * and zero countable votes narrows the picker to the shortlist, the
   * only names the published fallback rule allows (P0807).
   */
  const verdict = category === "community_favourite" ? vote : null;
  const decided = verdict?.state === "decided" ? verdict.winner : null;
  /* Both states hand the announcer a choice, and the engine accepts a
     different set in each: any shortlisted name when nobody voted (P0807),
     but only a tied leader when the vote tied (P0806). Same picker, two
     different lists and two different sentences. */
  const shortlistOnly = verdict?.state === "zero";
  const tiedTop = verdict?.state === "tied";
  const pickFromVerdict = shortlistOnly || tiedTop;
  const votePending = verdict?.state === "pending";

  const candidates =
    category === "creator_of_week"
      ? creatorCandidates
      : pickFromVerdict && verdict
        ? favouriteCandidates.filter((c) =>
            verdict.nomineeEnrolmentIds.includes(c.enrolmentId),
          )
        : favouriteCandidates;
  const selectedId = decided ? decided.enrolmentId : enrolmentId;
  const chosenName =
    decided?.name ?? candidates.find((c) => c.enrolmentId === selectedId)?.name;
  const amount = Number(prize);
  /* Named, not just set: a loaded draft can carry an id the current list
     no longer contains (the creator fell off the shortlist, or already won
     while the draft sat). The picker would show blank while the API quietly
     received the invisible id, so an id nobody can read is not ready. */
  const ready =
    Boolean(chosenName) &&
    Number.isInteger(amount) &&
    amount > 0 &&
    !votePending;

  /*
   * Who the no-repeat rule keeps out of the Creator of the Week picker, by
   * name. It was a count, worked out by subtracting the candidate list from
   * a separate leaderboard read: a creator approved between the two reads
   * showed as "1 creator is missing" when nobody had won, and past 500
   * ranked creators the count shrank or vanished. The announced picks are
   * already on this screen and are exactly the set the SQL filters on, so
   * the names come from them.
   */
  const pastCreatorsOfWeek = picked
    .filter((p) => p.category === "creator_of_week" && p.publishedAt)
    .sort((a, b) => a.weekNo - b.weekNo);

  const announcedThisWeek = picked.filter(
    (p) => p.weekNo === weekNo && p.publishedAt,
  ).length;

  /*
   * The saved draft for the selected category, surfaced.
   *
   * Saving a draft used to clear the form and render nothing anywhere: the
   * row sat in weekly_winners with published_at null and the screen showed no
   * trace of it, so the owner who saved on Saturday came back on Sunday to a
   * blank form and concluded the draft was lost. The upsert means one row per
   * week and category, which is also why the banner warns that saving a
   * different pick replaces it.
   */
  const draft =
    picked.find(
      (p) => p.weekNo === weekNo && p.category === category && !p.publishedAt,
    ) ?? null;

  /*
   * A Creator of the Week draft whose creator has since been announced for
   * another week. A draft stopped counting as a win in 0071, so this can now
   * exist, and the database refuses announcing it for good. The banner says
   * so rather than offering a Load that fills a blank picker.
   */
  const draftWonElsewhere =
    draft && draft.category === "creator_of_week"
      ? (pastCreatorsOfWeek.find((p) => p.enrolmentId === draft.enrolmentId) ??
        null)
      : null;

  function loadDraft() {
    if (!draft) return;
    setEnrolmentId(draft.enrolmentId);
    setPrize(String(draft.prizeNaira));
    setNote(draft.note ?? "");
  }

  async function save(act: Pending): Promise<boolean> {
    const { publish } = act;
    const label = CATEGORY_LABEL[act.category];
    setBusy(true);
    try {
      const response = await fetch("/api/admin/winners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekNo,
          category: act.category,
          enrolmentId: act.enrolmentId,
          prizeNaira: act.prizeNaira,
          note: act.note || undefined,
          publish,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return false;
      }

      if (publish && result.emailed === false) {
        /* The announcement stood; only the mail died. Said here, because a
           winner who never hears is otherwise discovered on Monday. */
        toast.warning(
          `${label} announced for week ${weekNo}, but the winner email did not send. Follow up with them directly.`,
        );
      } else {
        toast.success(
          publish
            ? `${label} announced for week ${weekNo}${result.emailed ? " and the winner has been emailed" : ""}`
            : "Saved as a draft. Nothing is public yet.",
        );
      }
      setEnrolmentId("");
      setPrize("");
      setNote("");
      await router.refresh();
      return true;
    } catch {
      toast.error("We could not reach the server.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function ask(publish: boolean) {
    if (!ready || !chosenName) {
      toast.error("Pick a creator and enter the prize amount.");
      return;
    }
    setChecked(false);
    setPending({
      publish,
      category,
      enrolmentId: selectedId,
      name: chosenName,
      prizeNaira: amount,
      note: note.trim(),
    });
  }

  /* The saved draft the pending act would overwrite, if any: one row per
     week and prize, so saving or announcing replaces it. */
  const pendingDraft = pending
    ? (picked.find(
        (p) =>
          p.weekNo === weekNo &&
          p.category === pending.category &&
          !p.publishedAt,
      ) ?? null)
    : null;

  async function confirmPending() {
    if (!pending) return;
    if (await save(pending)) setPending(null);
  }

  async function discardDraft() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/winners", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekNo, category }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      toast.success("Draft discarded. Nothing was ever public.");
      await router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function snapshot() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekNo }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      toast.success(
        `Week ${weekNo} recorded: ${result.rows} creators, version ${result.version}`,
      );
      await router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <JobCard
        collapsible
        id="freeze"
        step="Saturday"
        title={`Record the week ${weekNo} standings`}
        state={frozen ? "done" : "now"}
        status={
          frozen ? <Pill tone="good">Recorded</Pill> : <Pill>Not yet</Pill>
        }
        hint="Writes down the standings as they are today. Doing it again makes a new version and loses nothing."
        foot={
          canRecord ? (
            <button
              type="button"
              disabled={busy}
              onClick={snapshot}
              className={buttonClass(frozen ? "secondary" : "primary")}
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              {busy ? "Working…" : frozen ? "Record again" : "Record the standings"}
            </button>
          ) : (
            <p className="text-sm text-ink-3">
              {frozen
                ? `Week ${weekNo} is over, so its standings stay as they were recorded.`
                : `Week ${weekNo} is over, and its standings can no longer be recorded.`}
            </p>
          )
        }
      />

      <JobCard
        collapsible
        id="announce"
        step="Sunday"
        title={`Announce the week ${weekNo} winners`}
        state={announcedThisWeek >= 2 ? "done" : frozen ? "now" : "todo"}
        status={
          <>
            <Pill>{announcedThisWeek} of 2 announced</Pill>
            {draft && <Pill tone="gold">draft saved</Pill>}
          </>
        }
        hint="Chosen by a person, never automatically. A draft is invisible on the public page until you announce it."
        foot={
          <>
            <button
              type="button"
              disabled={busy || !ready}
              onClick={() => ask(false)}
              aria-haspopup="dialog"
              className={buttonClass("quiet")}
            >
              Save as draft
            </button>
            {/*
              * Offered only when it can actually be done.
              *
              * Save as draft was gated on `ready` and this was gated on
              * nothing, so the first thing on an untouched screen was a
              * live gold button for the one irreversible action in the
              * console, beside a disabled one for the safe action. The
              * shape of the screen argued for the wrong thing.
              *
              * Its question argued for it too. With nothing picked it read
              * "Announce this creator as Creator of the Week for week 2,
              * with no prize set?", and the button under it said "Yes,
              * announce it". A confirmation describing something that
              * cannot happen teaches people to click through
              * confirmations.
              *
              * frozen as well as ready, because publish_weekly_winner
              * refuses an unfrozen week with P0804 whatever this form
              * holds. Save as draft keeps its own gate: the engine allows
              * a draft before the freeze, and that is a real workflow on a
              * Saturday.
              */}
            {ready && frozen ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => ask(true)}
                aria-haspopup="dialog"
                className={buttonClass("primary")}
              >
                Announce {CATEGORY_LABEL[category]}…
              </button>
            ) : null}
            {!ready || !frozen ? (
              <p className="text-sm text-ink-2">
                {!ready && votePending
                  ? "Settle the vote below to unlock this announcement."
                  : !ready
                    ? "Pick a creator and enter the prize to continue."
                    : "Record the standings for this week before announcing."}
              </p>
            ) : null}
          </>
        }
      >
        <div className="space-y-4">
          {draft && (
            <div className="rounded-lg border border-line bg-card-2 p-4">
              <p className="text-sm font-semibold text-white">
                {draft.name}, {naira(draft.prizeNaira)}
              </p>
              {draft.note && (
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">
                  {draft.note}
                </p>
              )}
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
                {draftWonElsewhere
                  ? `Not public, and it cannot be: ${draft.name} was announced as Creator of the Week in week ${draftWonElsewhere.weekNo}, and nobody wins it twice. Discard it, or pick somebody else, which replaces this draft when you save.`
                  : "Not public. Load it below to announce it, or pick somebody else, which replaces this draft when you save."}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {!draftWonElsewhere && (
                  <button
                    type="button"
                    onClick={loadDraft}
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line-2 px-4 text-sm font-semibold text-white transition-colors hover:bg-card-3"
                  >
                    Load the draft into the form
                  </button>
                )}
                {/* Discarding was previously only possible by overwriting
                    with a different pick, which forced the wrong name to be
                    replaced by another name instead of by nothing. */}
                <Confirm
                  label="Discard this draft"
                  question={`Discard the ${CATEGORY_LABEL[category]} draft for week ${weekNo} (${draft.name}, ${naira(draft.prizeNaira)})?`}
                  consequence="The draft is deleted. It was never public, and announcing this week will start from a blank form."
                  confirmLabel="Yes, discard it"
                  intent="danger"
                  pending={busy}
                  onConfirm={discardDraft}
                />
              </div>
            </div>
          )}

          <Segmented<Category>
            legend="Which prize"
            value={category}
            onChange={(next) => {
              setCategory(next);
              setEnrolmentId("");
              setPrize(String(CATEGORY_PRIZE[next]));
            }}
            options={(Object.keys(CATEGORY_LABEL) as Category[]).map((key) => ({
              value: key,
              label: CATEGORY_LABEL[key],
            }))}
          />

          {/* The third of the three enforcements of the no-repeat rule: the
              database refuses it, the candidate list omits them, and this
              names who is not there and why. */}
          {category === "creator_of_week" && pastCreatorsOfWeek.length > 0 && (
            <p className="max-w-prose text-sm leading-relaxed text-ink-2">
              {pastCreatorsOfWeek.length === 1
                ? `${pastCreatorsOfWeek[0].name} is not in this list: Creator of the Week in week ${pastCreatorsOfWeek[0].weekNo}, and nobody wins it twice.`
                : `Not in this list, because nobody wins it twice: ${pastCreatorsOfWeek
                    .map((p) => `${p.name} (week ${p.weekNo})`)
                    .join(", ")}.`}{" "}
              Community Favourite has no such rule.
            </p>
          )}

          {votePending ? (
            <div className="rounded-lg border border-line bg-card-2 p-4">
              <p className="text-sm font-semibold text-white">
                The vote decides this one.
              </p>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">
                Close the round in the card below, sweep any suspicious
                votes, and mark the review complete. The winner then appears
                here, filled in.
              </p>
            </div>
          ) : decided ? (
            <div className="rounded-lg border border-line bg-card-2 p-4">
              <p className="text-sm font-semibold text-white">
                Decided by the vote: {decided.name},{" "}
                {decided.votes === 1 ? "1 verified vote" : `${decided.votes} verified votes`}
              </p>
              <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">
                There is nothing to pick. Announcing records the result the
                community reached; to dispute it, remove fraudulent votes in
                the round review below and this name changes with the tally.
              </p>
            </div>
          ) : (
            <Field
              id="winner"
              label="Creator"
              hint={
                tiedTop
                  ? `The vote is an exact tie on ${verdict?.votes ?? 0} votes, and the recorded standings do not separate them either. Only these names can be announced; any other is refused.`
                  : shortlistOnly
                    ? "No countable votes came in, so the rules fall back to Blockfest selecting, from the shortlist people were shown."
                    : "Type any part of a name. Ranked by the standings, so the leader is first."
              }
            >
              <CreatorPicker
                id="winner"
                candidates={candidates}
                value={enrolmentId}
                onChange={setEnrolmentId}
              />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="prize"
              label="Prize"
              hint={ready ? naira(amount) : "In naira, digits only."}
            >
              <input
                id="prize"
                name="prize"
                inputMode="numeric"
                autoComplete="off"
                value={prize}
                onChange={(event) =>
                  setPrize(event.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="300000"
                className={control}
              />
            </Field>

            <Field
              id="winner-note"
              label="Why they won"
              hint="Shown on the public winners page."
            >
              <input
                id="winner-note"
                name="note"
                autoComplete="off"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={300}
                placeholder="Carried the week on TikTok…"
                className={control}
              />
            </Field>
          </div>
        </div>
      </JobCard>

      <ActionDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={
          pending
            ? pending.publish
              ? `Announce the week ${weekNo} ${CATEGORY_LABEL[pending.category]}?`
              : `Save the week ${weekNo} ${CATEGORY_LABEL[pending.category]} as a draft?`
            : ""
        }
        busy={busy}
      >
        {pending && (
          <ConfirmWinner
            weekNo={weekNo}
            act={pending}
            replaces={pendingDraft}
            checked={checked}
            onCheck={setChecked}
            busy={busy}
            onCancel={() => setPending(null)}
            onConfirm={confirmPending}
          />
        )}
      </ActionDialog>
    </>
  );
}

/**
 * The last look before a winner is drafted or announced.
 *
 * The two prizes sit one tab apart in the same form, and the owner asked
 * that nobody be able to announce the wrong one by mistake. So the award
 * leads, larger than anything else here, with the week under it; then the
 * creator and the amount; then a line naming the other award, so a wrong
 * tab is caught by reading rather than by remembering. Announcing also asks
 * for a tick against a sentence that names the award, because it is public
 * at once and cannot be changed from here. Cancel takes focus, so Enter
 * never announces.
 */
function ConfirmWinner({
  weekNo,
  act,
  replaces,
  checked,
  onCheck,
  busy,
  onCancel,
  onConfirm,
}: {
  weekNo: number;
  act: Pending;
  replaces: PickedRow | null;
  checked: boolean;
  onCheck: (checked: boolean) => void;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const label = CATEGORY_LABEL[act.category];
  const self = CATEGORY_IN_A_SENTENCE[act.category];
  const other = CATEGORY_IN_A_SENTENCE[OTHER_CATEGORY[act.category]];
  const Icon = CATEGORY_ICON[act.category];
  const replacesSomeoneElse =
    replaces !== null && replaces.enrolmentId !== act.enrolmentId;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-card-2">
        <div className="flex items-center gap-3 border-b border-line p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-2 text-white">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-white">{label}</p>
            <p className="text-sm text-ink-3">Week {weekNo}</p>
          </div>
        </div>
        <dl className="divide-y divide-line px-4">
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-sm text-ink-3">Creator</dt>
            <dd className="min-w-0 text-right text-sm font-semibold text-white [overflow-wrap:anywhere]">
              {act.name}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-sm text-ink-3">Prize</dt>
            <dd className="text-sm font-semibold tabular-nums text-brand-gold">
              {naira(act.prizeNaira)}
            </dd>
          </div>
          {act.note && (
            <div className="flex flex-col gap-1 py-3">
              <dt className="text-sm text-ink-3">Why they won</dt>
              <dd className="text-sm leading-relaxed text-ink-2 [overflow-wrap:anywhere]">
                {act.note}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <p className="max-w-prose text-sm leading-relaxed text-white">
        This is {self}, {CATEGORY_DECIDED_BY[act.category]}. It is not{" "}
        {other}. If you meant {other}, cancel and change “Which prize” in the
        form.
      </p>

      <p className="max-w-prose text-sm leading-relaxed text-ink-2">
        {act.publish
          ? `Announcing puts ${act.name} and ${naira(act.prizeNaira)} on the public winners page straight away and emails them.${
              act.category === "community_favourite"
                ? " The other nominees are told the result."
                : ""
            } A published winner cannot be changed from here.${
              replacesSomeoneElse && replaces
                ? ` The saved draft for ${replaces.name} is replaced.`
                : ""
            }`
          : `Nothing goes public. The draft waits on this screen until someone announces it.${
              replacesSomeoneElse && replaces
                ? ` It replaces the saved draft (${replaces.name}, ${naira(replaces.prizeNaira)}).`
                : replaces
                  ? ` It updates the saved draft for ${replaces.name}.`
                  : ""
            }`}
      </p>

      {act.publish && (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm text-white">
          <input
            type="checkbox"
            checked={checked}
            disabled={busy}
            onChange={(event) => onCheck(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-gold disabled:cursor-not-allowed"
          />
          <span>
            I have checked that {act.name} is the week {weekNo} {label}.
          </span>
        </label>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          data-autofocus
          disabled={busy}
          onClick={onCancel}
          className={buttonClass("quiet", "w-full sm:w-auto")}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || (act.publish && !checked)}
          onClick={onConfirm}
          className={buttonClass(
            act.publish ? "primary" : "secondary",
            "w-full sm:w-auto",
          )}
        >
          {act.publish
            ? busy
              ? "Announcing…"
              : `Yes, announce the ${label}`
            : busy
              ? "Saving…"
              : "Yes, save the draft"}
        </button>
      </div>
    </div>
  );
}
