"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Confirm } from "@/components/shared/confirm";
import {
  buttonClass,
  control,
  Field,
  JobCard,
  Pill,
  selectControl,
} from "@/components/shared/panel";
import { ActionDialog } from "@/components/shared/action-dialog";
import { reveal } from "@/components/shared/reveal";
import { dateTime } from "@/lib/format";

export interface EditableChallenge {
  id: string;
  weekNo: number;
  title: string;
  description: string;
  /** The card narrative. Null means the registry copy in code still speaks;
      once an admin writes something, the database is the voice. */
  question: string | null;
  focus: string | null;
  skills: string[] | null;
  basePoints: number;
  status: "draft" | "active" | "closed";
  startsAt: string;
  endsAt: string;
  /** Ended weeks are the record of how their winners were decided. */
  readonly_: boolean;
}

const STATUS_TONE = { draft: "neutral", active: "good", closed: "bad" } as const;

/**
 * The weekly challenges, editable by the team (#67).
 *
 * Briefs drop at the weekend, which is exactly when a solo developer should
 * not be on call, so from stage 2 onward the team drives this themselves:
 * write the challenge as a draft, read it over, flip it active on the Monday.
 * The stage list on the public page reveals a challenge only when its stage is
 * live, so a draft here leaks nothing there.
 */
export function ChallengeEditor({ challenges }: { challenges: EditableChallenge[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    question: "",
    focus: "",
    skills: "",
    basePoints: "",
    status: "",
  });

  /*
   * What the open challenge looked like when editing began.
   *
   * One `form` object is shared by every week, so opening a second week
   * overwrote the first in place. Combined with a Cancel that called
   * setOpen(null) directly, two thousand characters of a stage brief lived
   * only in React state and could be wiped by the same button that said
   * "Edit" a moment earlier. This is the screen whose text is emailed to
   * every creator in the campaign.
   */
  const [baseline, setBaseline] = useState<typeof form | null>(null);
  /** Where the reviewer was heading when a dirty form stopped them. */
  const [discarding, setDiscarding] = useState<
    { to: EditableChallenge | null } | null
  >(null);

  const dirty =
    baseline !== null &&
    (Object.keys(baseline) as (keyof typeof baseline)[]).some(
      (k) => form[k] !== baseline[k],
    );

  /*
   * Bring an editor that just opened into view, with the cursor in Title.
   *
   * It expands in place under its week, and at about 900px its Save button
   * always lands below the fold; opening a lower week also collapses the one
   * above, which moves the pressed row up the page. Without this the admin was
   * left looking at wherever the page happened to settle.
   */
  useEffect(() => {
    if (!open) return;
    reveal(
      document.getElementById(`week-${open}`),
      document.getElementById(`title-${open}`),
      "start",
    );
  }, [open]);

  function startEditing(challenge: EditableChallenge) {
    const next = {
      title: challenge.title,
      description: challenge.description,
      question: challenge.question ?? "",
      focus: challenge.focus ?? "",
      skills: (challenge.skills ?? []).join(", "),
      basePoints: String(challenge.basePoints),
      status: challenge.status,
    };
    setOpen(challenge.id);
    setForm(next);
    setBaseline(next);
    setDiscarding(null);
  }

  /** Close, or move to another week, throwing away what was typed. */
  function leaveEditor(to: EditableChallenge | null) {
    setDiscarding(null);
    setBaseline(null);
    if (to) startEditing(to);
    else setOpen(null);
  }

  /*
   * Every way out of an open editor goes through here, so the guard cannot
   * be bypassed by taking the other one: Cancel on this week, and Edit on
   * a different week, both discard the same unsaved text.
   */
  function askToLeave(to: EditableChallenge | null) {
    if (dirty) setDiscarding({ to });
    else leaveEditor(to);
  }

  /**
   * Tell every active creator a stage is live.
   *
   * Deliberately a separate press from Save. The team edits a challenge
   * repeatedly while writing it, and a send that rode along with the edit
   * would mail the whole campaign on a typo fix. The route refuses a
   * second announcement of the same stage, so a double click costs
   * nothing.
   */
  async function announce(challenge: EditableChallenge) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/announce-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      toast.success(
        result.failed
          ? `Week ${challenge.weekNo} announced to ${result.sent}. ${result.failed} did not send.`
          : `Week ${challenge.weekNo} announced to ${result.sent} creators.`,
      );
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
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
          question: form.question.trim(),
          focus: form.focus.trim(),
          /* Comma separated in the box, an array on the wire. Empty means
             keep what is there, same rule as every other field here. */
          skills: form.skills
            .split(",")
            .map((skill) => skill.trim())
            .filter(Boolean),
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
      // Saved text is no longer unsaved text, so closing here must not trip
      // the discard guard on the way out.
      setBaseline(null);
      setDiscarding(null);
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
      title="The weekly challenges"
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
      hint="Write next week's challenge as a draft, read it over, flip it active on the Monday. Closing stops new entries and leaves what arrived reviewable."
    >
      {/*
       * The unsaved-changes question, in front of the admin.
       *
       * It used to render inside the week that was open, at the top of that
       * week's editor. Pressing Edit on another week while this one had
       * unsaved text therefore put the question a whole editor's height away
       * from the button, often above the screen. A dialog asks it where the
       * button was pressed, and still defaults to the answer that changes
       * nothing.
       */}
      <ActionDialog
        open={discarding !== null}
        onOpenChange={(next) => {
          if (!next) setDiscarding(null);
        }}
        title="Discard what you have written?"
        tone="danger"
      >
        <p className="max-w-prose text-sm leading-relaxed text-ink-2">
          This brief has not been saved. It is the text emailed to every
          creator when the stage is announced, and nothing here keeps a copy.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {/* Keep editing first and focused, matching Confirm: the default
              action is the one that changes nothing. */}
          <button
            type="button"
            data-autofocus
            onClick={() => setDiscarding(null)}
            className={buttonClass("secondary")}
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={() => discarding && leaveEditor(discarding.to)}
            className={buttonClass("danger")}
          >
            {discarding?.to
              ? `Discard and open week ${discarding.to.weekNo}`
              : "Discard it"}
          </button>
        </div>
      </ActionDialog>

      <ul className="flex flex-col gap-3">
        {challenges.map((challenge) => (
          <li
            key={challenge.id}
            id={`week-${challenge.id}`}
            className="scroll-mt-24 rounded-lg border border-line p-4"
          >
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
                    open === challenge.id
                      ? askToLeave(null)
                      : open
                        ? askToLeave(challenge)
                        : startEditing(challenge)
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
                  label="The challenge"
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
                    id={`question-${challenge.id}`}
                    label="Question line"
                    hint="The bold line under the title, e.g. Make Them Curious."
                  >
                    <input
                      id={`question-${challenge.id}`}
                      value={form.question}
                      onChange={(event) =>
                        setForm({ ...form, question: event.target.value })
                      }
                      maxLength={120}
                      className={control}
                    />
                  </Field>

                  <Field
                    id={`skills-${challenge.id}`}
                    label="Skill chips"
                    hint="Comma separated. The campaign's four: Creativity, Storytelling, Education, Influence."
                  >
                    <input
                      id={`skills-${challenge.id}`}
                      value={form.skills}
                      onChange={(event) =>
                        setForm({ ...form, skills: event.target.value })
                      }
                      maxLength={120}
                      className={control}
                    />
                  </Field>
                </div>

                <Field
                  id={`focus-${challenge.id}`}
                  label="Focus line"
                  hint="The short paragraph on the stage card. The full brief above is what unfolds; this is the glance."
                >
                  <textarea
                    id={`focus-${challenge.id}`}
                    value={form.focus}
                    onChange={(event) =>
                      setForm({ ...form, focus: event.target.value })
                    }
                    maxLength={300}
                    rows={2}
                    className={`${control} min-h-20 resize-y`}
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

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => save(challenge)}
                    className={buttonClass("primary", "w-fit")}
                  >
                    {busy ? "Saving…" : `Save week ${challenge.weekNo}`}
                  </button>

                  {/* Only for a week that is actually live, because the
                      mail tells creators to go and submit. Separate from
                      Save on purpose: the brief gets edited repeatedly
                      while it is being written, and a send riding along
                      with an edit would mail the campaign on a typo. */}
                  {challenge.status === "active" && (
                    <Confirm
                      label="Announce to creators"
                      question={`Email every active creator that week ${challenge.weekNo} is live?`}
                      consequence="One email each, with the brief and the deadline. It can only be sent once per stage, and the audit log records who sent it and how many reached their inbox."
                      confirmLabel="Yes, announce it"
                      pending={busy}
                      onConfirm={() => announce(challenge)}
                    />
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </JobCard>
  );
}
