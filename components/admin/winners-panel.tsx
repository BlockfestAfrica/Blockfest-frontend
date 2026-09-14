"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import {
  buttonClass,
  control,
  Field,
  JobCard,
  Pill,
  Segmented,
  selectControl,
} from "@/components/shared/panel";
import { Confirm } from "@/components/shared/confirm";
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
  state: "pending" | "decided" | "zero";
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
  excludedCount,
  picked,
  frozen,
  vote,
}: {
  weekNo: number;
  creatorCandidates: CandidateRow[];
  favouriteCandidates: CandidateRow[];
  excludedCount: number;
  picked: PickedRow[];
  /** Whether this week's standings have been recorded yet. */
  frozen: boolean;
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
   * The vote's verdict shapes the Community Favourite half of this card.
   * With a decided round the picker disappears: the engine refuses any
   * other name (P0806), so a dropdown here would only be a menu of
   * errors. A pending round blocks announcing until the review is done,
   * and zero countable votes narrows the picker to the shortlist, the
   * only names the published fallback rule allows (P0807).
   */
  const verdict = category === "community_favourite" ? vote : null;
  const decided = verdict?.state === "decided" ? verdict.winner : null;
  const shortlistOnly = verdict?.state === "zero";
  const votePending = verdict?.state === "pending";

  const candidates =
    category === "creator_of_week"
      ? creatorCandidates
      : shortlistOnly && verdict
        ? favouriteCandidates.filter((c) =>
            verdict.nomineeEnrolmentIds.includes(c.enrolmentId),
          )
        : favouriteCandidates;
  const selectedId = decided ? decided.enrolmentId : enrolmentId;
  const chosenName =
    decided?.name ?? candidates.find((c) => c.enrolmentId === selectedId)?.name;
  const amount = Number(prize);
  const ready =
    Boolean(selectedId) &&
    Number.isInteger(amount) &&
    amount > 0 &&
    !votePending;

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

  function loadDraft() {
    if (!draft) return;
    setEnrolmentId(draft.enrolmentId);
    setPrize(String(draft.prizeNaira));
    setNote(draft.note ?? "");
  }

  async function save(publish: boolean) {
    if (!ready) {
      toast.error("Pick a creator and enter the prize amount.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/winners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekNo,
          category,
          enrolmentId: selectedId,
          prizeNaira: amount,
          note: note.trim() || undefined,
          publish,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }

      toast.success(
        publish
          ? `${CATEGORY_LABEL[category]} announced for week ${weekNo}`
          : "Saved as a draft. Nothing is public yet.",
      );
      setEnrolmentId("");
      setPrize("");
      setNote("");
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
        id="freeze"
        step="Saturday"
        title={`Record the week ${weekNo} standings`}
        state={frozen ? "done" : "now"}
        status={
          frozen ? <Pill tone="good">Recorded</Pill> : <Pill>Not yet</Pill>
        }
        hint="Writes down the standings as they are today. Doing it again makes a new version and loses nothing."
        foot={
          <button
            type="button"
            disabled={busy}
            onClick={snapshot}
            className={buttonClass(frozen ? "secondary" : "primary")}
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            {busy ? "Working…" : frozen ? "Record again" : "Record the standings"}
          </button>
        }
      />

      <JobCard
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
              onClick={() => save(false)}
              className={buttonClass("quiet")}
            >
              Save as draft
            </button>
            <Confirm
              label={`Announce ${CATEGORY_LABEL[category]}`}
              question={`Announce ${chosenName ?? "this creator"} as ${CATEGORY_LABEL[category]} for week ${weekNo}, with ${ready ? naira(amount) : "no prize set"}?`}
              consequence="This publishes the name and the amount on the public winners page straight away. There is no undo here."
              confirmLabel={`Yes, announce ${ready ? naira(amount) : "it"}`}
              pending={busy}
              onConfirm={() => save(true)}
            />
            {!ready && (
              <p className="text-sm text-ink-2">
                {votePending
                  ? "Settle the vote below to unlock this announcement."
                  : "Pick a creator and enter the prize to continue."}
              </p>
            )}
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
                Not public. Load it below to announce it, or pick somebody
                else, which replaces this draft when you save.
              </p>
              <button
                type="button"
                onClick={loadDraft}
                className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line-2 px-4 text-sm font-semibold text-white transition-colors hover:bg-card-3"
              >
                Load the draft into the form
              </button>
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
              index refuses it, the candidate list omits them, and this says
              why a name somebody is looking for is not there. */}
          {category === "creator_of_week" && excludedCount > 0 && (
            <p className="max-w-prose text-sm leading-relaxed text-ink-2">
              {excludedCount}{" "}
              {excludedCount === 1 ? "creator is" : "creators are"} missing from
              this list because they have already been Creator of the Week.
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
                shortlistOnly
                  ? "No countable votes came in, so the rules fall back to Blockfest selecting, from the shortlist people were shown."
                  : "Ranked by the standings, so the leader is first."
              }
            >
              <select
                id="winner"
                name="winner"
                value={enrolmentId}
                onChange={(event) => setEnrolmentId(event.target.value)}
                className={selectControl}
              >
                <option value="">Pick a creator…</option>
                {candidates.map((c) => (
                  <option key={c.enrolmentId} value={c.enrolmentId}>
                    {c.rank}. {c.name} ({c.points} points)
                  </option>
                ))}
              </select>
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
    </>
  );
}
