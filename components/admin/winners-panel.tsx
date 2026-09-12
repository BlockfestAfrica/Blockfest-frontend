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

export interface CandidateRow {
  enrolmentId: string;
  name: string;
  points: number;
  rank: number;
}

export interface PickedRow {
  weekNo: number;
  category: "creator_of_week" | "community_favourite";
  name: string;
  prizeNaira: number;
  publishedAt: string | null;
}

const CATEGORY_LABEL = {
  creator_of_week: "Creator of the Week",
  community_favourite: "Community Favourite",
} as const;

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
 * Sunday. Each is now an object with a name, a state on its edge, and a foot
 * containing the control that performs it. Nothing here is boxed: a fill over
 * this background lands a few values out of 255, which is the defect already
 * found and rejected once. The boundary is a coloured edge and two hairlines.
 */
export function WinnersPanel({
  weekNo,
  creatorCandidates,
  favouriteCandidates,
  excludedCount,
  picked,
  frozen,
}: {
  weekNo: number;
  creatorCandidates: CandidateRow[];
  favouriteCandidates: CandidateRow[];
  excludedCount: number;
  picked: PickedRow[];
  /** Whether this week's standings have been recorded yet. */
  frozen: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<Category>("creator_of_week");
  const [enrolmentId, setEnrolmentId] = useState("");
  const [prize, setPrize] = useState("");
  const [note, setNote] = useState("");

  const candidates =
    category === "creator_of_week" ? creatorCandidates : favouriteCandidates;
  const chosen = candidates.find((c) => c.enrolmentId === enrolmentId);
  const amount = Number(prize);
  const ready = Boolean(enrolmentId) && Number.isInteger(amount) && amount > 0;

  const announcedThisWeek = picked.filter(
    (p) => p.weekNo === weekNo && p.publishedAt,
  ).length;

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
          enrolmentId,
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
        hint="Writes down the standings as they are today. The live board always shows where things stand now; only this can answer where they stood on a particular Saturday, which is the question asked in October when the prizes are settled. Doing it again makes a new version and loses nothing."
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
        status={<Pill>{announcedThisWeek} of 2 announced</Pill>}
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
              question={`Announce ${chosen?.name ?? "this creator"} as ${CATEGORY_LABEL[category]} for week ${weekNo}, with ${ready ? naira(amount) : "no prize set"}?`}
              consequence="This publishes the name and the amount on the public winners page straight away. There is no undo here."
              confirmLabel={`Yes, announce ${ready ? naira(amount) : "it"}`}
              pending={busy}
              onConfirm={() => save(true)}
            />
            {!ready && (
              <p className="text-sm text-white/70">
                Pick a creator and enter the prize to continue.
              </p>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <Segmented<Category>
            legend="Which prize"
            value={category}
            onChange={(next) => {
              setCategory(next);
              setEnrolmentId("");
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
            <p className="max-w-prose text-sm leading-relaxed text-white/70">
              {excludedCount}{" "}
              {excludedCount === 1 ? "creator is" : "creators are"} missing from
              this list because they have already been Creator of the Week. It
              cannot go to the same person twice. Community Favourite can.
            </p>
          )}

          <Field
            id="winner"
            label="Creator"
            hint="Ranked by the standings, so the leader is first."
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
