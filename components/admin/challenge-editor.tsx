"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  buttonClass,
  control,
  Field,
  JobCard,
  Pill,
  selectControl,
} from "@/components/shared/panel";
import { dateTime } from "@/lib/format";

export interface EditableChallenge {
  id: string;
  weekNo: number;
  title: string;
  description: string;
  basePoints: number;
  status: "draft" | "active" | "closed";
  startsAt: string;
  endsAt: string;
  /** Ended weeks are the record of how their winners were decided. */
  readonly_: boolean;
}

const STATUS_TONE = { draft: "neutral", active: "good", closed: "bad" } as const;

/**
 * The weekly briefs, editable by the team (#67).
 *
 * Briefs drop at the weekend, which is exactly when a solo developer should
 * not be on call, so from stage 2 onward the team drives this themselves:
 * write the brief as a draft, read it over, flip it active on the Monday.
 * The stage list on the public page reveals a brief only when its stage is
 * live, so a draft here leaks nothing there.
 */
export function ChallengeEditor({ challenges }: { challenges: EditableChallenge[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", basePoints: "", status: "" });

  function startEditing(challenge: EditableChallenge) {
    setOpen(challenge.id);
    setForm({
      title: challenge.title,
      description: challenge.description,
      basePoints: String(challenge.basePoints),
      status: challenge.status,
    });
  }

  async function save(challenge: EditableChallenge) {
    const points = Number(form.basePoints);
    if (!Number.isInteger(points) || points <= 0) {
      toast.error("Base points have to be a positive number.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          title: form.title.trim(),
          description: form.description.trim(),
          basePoints: points,
          status: form.status,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }

      toast.success(`Week ${challenge.weekNo} saved.`);
      setOpen(null);
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <JobCard
      id="stages"
      title="The weekly briefs"
      /* The edge is derived, not decorative: gold when the live week is
         still a draft or wearing a seeded placeholder title, which is
         exactly when this card needs a person before Monday. */
      state={
        challenges.some(
          (c) =>
            !c.readonly_ &&
            (c.status === "draft" || c.title === "The Proof"),
        )
          ? "now"
          : "todo"
      }
      hint="Write next week's brief as a draft, read it over, flip it active on the Monday. Closing stops new entries and leaves what arrived reviewable."
    >
      <ul className="flex flex-col gap-3">
        {challenges.map((challenge) => (
          <li key={challenge.id} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-semibold text-white">
                Week {challenge.weekNo}: {challenge.title}
              </span>
              <Pill tone={STATUS_TONE[challenge.status]}>{challenge.status}</Pill>
              <span className="text-sm text-ink-3">
                {dateTime(challenge.startsAt)} to {dateTime(challenge.endsAt)}
              </span>
              <span className="text-sm tabular-nums text-ink-3">
                base {challenge.basePoints}
              </span>
              {challenge.readonly_ ? (
                <span className="ml-auto text-sm text-ink-4">ended, locked</span>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    open === challenge.id ? setOpen(null) : startEditing(challenge)
                  }
                  aria-expanded={open === challenge.id}
                  className="ml-auto inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-semibold text-ink-3 transition-colors hover:text-white"
                >
                  {open === challenge.id ? "Cancel" : "Edit"}
                </button>
              )}
            </div>

            {open === challenge.id && !challenge.readonly_ && (
              <div className="mt-4 flex flex-col gap-4">
                <Field id={`title-${challenge.id}`} label="Title">
                  <input
                    id={`title-${challenge.id}`}
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    maxLength={120}
                    className={control}
                  />
                </Field>

                <Field
                  id={`brief-${challenge.id}`}
                  label="The brief"
                  hint="What creators read on the Monday. Plain sentences carry it."
                >
                  <textarea
                    id={`brief-${challenge.id}`}
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    maxLength={2000}
                    rows={4}
                    className={`${control} min-h-28 resize-y`}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id={`points-${challenge.id}`}
                    label="Base points"
                    hint="Only entries created AFTER a change use the new rate. Points already told to a creator never move."
                  >
                    <input
                      id={`points-${challenge.id}`}
                      inputMode="numeric"
                      value={form.basePoints}
                      onChange={(event) =>
                        setForm({ ...form, basePoints: event.target.value.replace(/[^\d]/g, "") })
                      }
                      className={control}
                    />
                  </Field>

                  <Field
                    id={`status-${challenge.id}`}
                    label="Status"
                    hint="Draft is invisible. Active takes entries inside its window. Closed stops them."
                  >
                    <select
                      id={`status-${challenge.id}`}
                      value={form.status}
                      onChange={(event) => setForm({ ...form, status: event.target.value })}
                      className={selectControl}
                    >
                      <option value="draft">draft</option>
                      <option value="active">active</option>
                      <option value="closed">closed</option>
                    </select>
                  </Field>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => save(challenge)}
                  className={buttonClass("primary", "w-fit")}
                >
                  {busy ? "Saving…" : `Save week ${challenge.weekNo}`}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </JobCard>
  );
}
