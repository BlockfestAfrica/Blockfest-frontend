"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Panel, Pill, SectionHeading } from "@/components/shared/panel";

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

/**
 * Choosing and announcing the weekly winners.
 *
 * The candidate list for Creator of the Week arrives already filtered: a past
 * winner is not in it, because the rules say it cannot go to the same person
 * twice. The count of who was removed is shown rather than hidden, so an owner
 * looking for a name and not finding it gets an answer instead of a mystery.
 * That is the third of the three enforcements, and the only one a person sees.
 *
 * Draft and publish are one control with two buttons. The choice is made on the
 * Saturday and announced on the Sunday, and nothing a draft touches is public.
 */
export function WinnersPanel({
  weekNo,
  creatorCandidates,
  favouriteCandidates,
  excludedCount,
  picked,
}: {
  weekNo: number;
  creatorCandidates: CandidateRow[];
  favouriteCandidates: CandidateRow[];
  excludedCount: number;
  picked: PickedRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [category, setCategory] =
    useState<keyof typeof CATEGORY_LABEL>("creator_of_week");
  const [enrolmentId, setEnrolmentId] = useState("");
  const [prize, setPrize] = useState("");
  const [note, setNote] = useState("");

  const candidates =
    category === "creator_of_week" ? creatorCandidates : favouriteCandidates;

  async function save(publish: boolean) {
    const amount = Number(prize);
    if (!enrolmentId) {
      toast.error("Pick a creator.");
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("Enter the prize amount in naira.");
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
          : `Saved as a draft, not yet public`,
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
        `Week ${weekNo} frozen: ${result.rows} creators, version ${result.version}`,
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
      <SectionHeading
        label="Saturday"
        title={`Freeze week ${weekNo}`}
        hint="Records the standings as they are now. A live board answers what the standings are; only this answers what they were, which is the question asked in October. Taking it again makes a new version and loses nothing."
      />
      <button
        type="button"
        disabled={busy}
        onClick={snapshot}
        className="mt-4 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border border-white/20 px-6 text-sm font-semibold text-white transition-colors duration-300 hover:bg-white/10 disabled:opacity-60"
      >
        <Camera className="h-4 w-4" aria-hidden="true" />
        {busy ? "Working..." : `Freeze week ${weekNo} standings`}
      </button>

      <div className="mt-12">
        <SectionHeading
          label="Sunday"
          title={`Week ${weekNo} winners`}
          hint="Chosen by a person, never automatically. A draft is invisible on the public page until you announce it."
        />

        <div className="mt-5 flex flex-wrap gap-2">
          {(
            Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]
          ).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setCategory(key);
                setEnrolmentId("");
              }}
              aria-pressed={category === key}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                category === key
                  ? "border-brand-gold bg-brand-gold/15 text-brand-gold"
                  : "border-white/20 text-white/60 hover:text-white"
              }`}
            >
              {CATEGORY_LABEL[key]}
            </button>
          ))}
        </div>

        {/* The third enforcement: say why a name is missing, rather than
            letting an owner hunt for somebody the list will never offer. */}
        {category === "creator_of_week" && excludedCount > 0 && (
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-amber-200/80">
            {excludedCount}{" "}
            {excludedCount === 1 ? "creator is" : "creators are"} not listed
            because they have already been Creator of the Week. The rules say it
            cannot go to the same person twice. Community Favourite has no such
            limit.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3">
          <label htmlFor="winner" className="sr-only">
            The creator
          </label>
          <select
            id="winner"
            value={enrolmentId}
            onChange={(event) => setEnrolmentId(event.target.value)}
            className="min-h-12 w-full cursor-pointer rounded-lg border border-white/15 bg-ground px-4 text-base text-white focus:border-brand-gold focus:outline-none"
          >
            <option value="">Pick a creator</option>
            {candidates.map((c) => (
              <option key={c.enrolmentId} value={c.enrolmentId}>
                {c.rank}. {c.name} ({c.points} points)
              </option>
            ))}
          </select>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="prize" className="sr-only">
              Prize in naira
            </label>
            <input
              id="prize"
              inputMode="numeric"
              value={prize}
              onChange={(event) =>
                setPrize(event.target.value.replace(/[^\d]/g, ""))
              }
              placeholder="Prize in naira"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-3 text-base text-white placeholder:text-white/55 focus:border-brand-gold focus:outline-none"
            />
            <label htmlFor="winner-note" className="sr-only">
              Why, shown on the winners page
            </label>
            <input
              id="winner-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={300}
              placeholder="Why. Shown publicly."
              className="min-w-0 flex-[2] rounded-lg border border-white/15 bg-white/[0.03] px-4 py-3 text-base text-white placeholder:text-white/55 focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => save(false)}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border border-white/20 px-6 text-sm font-semibold text-white transition-colors duration-300 hover:bg-white/10 disabled:opacity-60"
            >
              Save as draft
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => save(true)}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-brand-gold px-6 text-sm font-semibold text-black transition-colors duration-300 hover:bg-brand-gold-hover disabled:opacity-60"
            >
              <Trophy className="h-4 w-4" aria-hidden="true" />
              {busy ? "Working..." : "Announce"}
            </button>
          </div>
        </div>
      </div>

      {picked.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-bold text-white">Chosen so far</h2>
          <ul className="mt-4 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/12">
            {picked.map((p) => (
              <li
                key={`${p.weekNo}-${p.category}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4"
              >
                <span className="text-sm font-semibold text-white">
                  W{p.weekNo}
                </span>
                <span className="text-sm text-white/60">
                  {CATEGORY_LABEL[p.category]}
                </span>
                <span className="text-base font-semibold text-white">
                  {p.name}
                </span>
                <span className="tabular-nums text-sm text-white/60">
                  ₦{p.prizeNaira.toLocaleString("en-NG")}
                </span>
                {p.publishedAt ? (
                  <Pill tone="good">Announced</Pill>
                ) : (
                  <Pill>Draft, not public</Pill>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {picked.length === 0 && (
        <Panel tone="quiet" className="mt-12">
          <p className="text-sm leading-relaxed text-white/60">
            Nothing chosen yet. The first winners are announced Sunday 20
            September.
          </p>
        </Panel>
      )}
    </>
  );
}
