"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buttonClass, control, Field, JobCard, Pill } from "@/components/shared/panel";
import { Confirm, ConfirmPanel } from "@/components/shared/confirm";
import { ActionDialog } from "@/components/shared/action-dialog";

/** Rows shown before the reader asks for more. */
const PAGE = 10;

export interface ResourceRow {
  id: string;
  section: string;
  title: string;
  body: string | null;
  url: string | null;
  displayOrder: number;
  isPublished: boolean;
}

const EMPTY = { id: null as string | null, section: "pack", title: "", body: "", url: "", displayOrder: "0", isPublished: false };

/**
 * The pack resources, editable without a deploy (#70).
 *
 * Plain text only, stated in the card because the constraint is deliberate:
 * the public page escapes everything, so HTML typed here renders as the
 * characters themselves. A draft is invisible publicly until published.
 */
export function ResourcesEditor({ rows }: { rows: ResourceRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  /** The form as it was when this add or edit began, so a draft can be told apart. */
  const [baseline, setBaseline] = useState(EMPTY);
  /*
   * Where the admin was heading when unsaved text stopped them: closing, a
   * fresh add, or another row's edit. Nothing keeps a copy of a draft of up
   * to two thousand characters, and Cancel sat right beside Save, so it asks
   * first, the same as the weekly challenge editor does.
   */
  const [discarding, setDiscarding] = useState<{ to: ResourceRow | "new" | "close" } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /*
   * Ten at a time, because a season's worth of resources buries the add
   * form below the fold on a phone. The window only grows, so an open
   * editor keeps its place.
   */
  const [visible, setVisible] = useState(PAGE);

  const dirty = (Object.keys(EMPTY) as (keyof typeof EMPTY)[]).some(
    (k) => form[k] !== baseline[k],
  );

  /** Go where the admin asked, dropping whatever was typed. */
  function leave(to: ResourceRow | "new" | "close") {
    setDiscarding(null);
    if (to === "close" || to === "new") {
      setForm(EMPTY);
      setBaseline(EMPTY);
      setOpen(to === "new");
      return;
    }
    const next = {
      id: to.id,
      section: to.section,
      title: to.title,
      body: to.body ?? "",
      url: to.url ?? "",
      displayOrder: String(to.displayOrder),
      isPublished: to.isPublished,
    };
    setForm(next);
    setBaseline(next);
    setOpen(true);
  }

  /** The same, but a draft is shown and asked about before it goes. */
  function requestLeave(to: ResourceRow | "new" | "close") {
    if (!dirty) return leave(to);
    setDiscarding({ to });
    setOpen(true);
  }

  function startEditing(row: ResourceRow) {
    // Reopening the row whose edit is still in the form resumes it.
    if (form.id === row.id) return setOpen(true);
    requestLeave(row);
  }

  async function save() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/resource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "save",
          id: form.id,
          section: form.section.trim(),
          title: form.title.trim(),
          body: form.body.trim(),
          url: form.url.trim(),
          displayOrder: Number(form.displayOrder) || 0,
          isPublished: form.isPublished,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      toast.success(form.isPublished ? "Saved and live within a minute." : "Saved as a draft.");
      setForm(EMPTY);
      setBaseline(EMPTY);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/resource", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "delete", id }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      toast.success("Deleted.");
      router.refresh();
    } catch {
      toast.error("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <JobCard
      id="resources"
      title="Pack resources"
      state={rows.some((r) => r.isPublished) ? "todo" : "now"}
      hint="Links and notes under Resources on the campaign landing page, live within a minute of saving, no deploy. Plain text only: anything that looks like HTML renders as the characters themselves, on purpose. Links must be https."
    >
      <ul className="flex flex-col gap-2">
        {rows.slice(0, visible).map((row) => (
          <li key={row.id} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-semibold text-white">{row.title}</span>
              <Pill>{row.section}</Pill>
              <Pill tone={row.isPublished ? "good" : "neutral"}>
                {row.isPublished ? "live" : "draft"}
              </Pill>
              <span className="ml-auto flex gap-1">
                <button
                  type="button"
                  onClick={() => startEditing(row)}
                  aria-haspopup="dialog"
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-semibold text-ink-3 transition-colors hover:text-white"
                >
                  Edit
                </button>
                {/* Through Confirm, like every other destructive action in
                    the console. It sat beside Edit in the same cluster, two
                    pills a few pixels apart, and a mis-tap permanently
                    removed something live on the public campaign page.
                    Disqualifying has a two-step panel and announcing has
                    this component; deleting a resource skipped both. */}
                <Confirm
                  label="Delete"
                  intent="danger"
                  question={`Delete “${row.title}”?`}
                  consequence="It disappears from the public Resources list within a minute. There is no undo."
                  confirmLabel="Yes, delete it"
                  pending={busy}
                  onConfirm={() => remove(row.id)}
                />
              </span>
            </div>
            {row.url && <p className="mt-1 break-all font-mono text-sm text-ink-3">{row.url}</p>}
          </li>
        ))}
        {rows.length === 0 && (
          <li className="text-sm text-ink-3">Nothing yet. Add the first one below.</li>
        )}
      </ul>
      {rows.length > visible ? (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE)}
          className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-link underline underline-offset-4 transition-colors hover:bg-card-2 hover:text-white"
        >
          Show more ({rows.length - visible} more)
        </button>
      ) : (
        rows.length > 0 && (
          <p className="mt-3 text-sm text-ink-4">
            Showing all {rows.length}{" "}
            {rows.length === 1 ? "resource" : "resources"}.
          </p>
        )
      )}

      {/* A draft of a new resource survives a dismissed dialog, and comes
          back here. Only a save, or a discard the admin agreed to, clears
          it; leaving an unsaved edit for a fresh add asks first. */}
      <button type="button" onClick={() => (form.id ? requestLeave("new") : setOpen(true))}
        aria-haspopup="dialog" className={buttonClass("secondary", "mt-4 w-fit")}>
        Add a resource
      </button>

      {/*
       * One dialog for adding and editing, opened in front of the admin.
       *
       * The form used to render once, after the whole list, where the Add
       * button sits. Edit on an upper row therefore changed nothing visible
       * on a long list, and pressing Edit on a second row while one was open
       * silently swapped the form underneath. The dialog opens where they are
       * looking and holds the page still until it is saved or dismissed.
       */}
      <ActionDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setOpen(false);
            setDiscarding(null);
          }
        }}
        title={form.id ? "Edit resource" : "Add a resource"}
        busy={busy}
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="res-title" label="Title">
              <input id="res-title" data-autofocus={discarding ? undefined : true} value={form.title} maxLength={160}
                onChange={(e) => setForm({ ...form, title: e.target.value })} className={control} />
            </Field>
            <Field id="res-section" label="Section" hint="A short slug: pack, faq, announcements.">
              <input id="res-section" value={form.section} maxLength={40}
                autoCapitalize="none" spellCheck={false}
                onChange={(e) => setForm({ ...form, section: e.target.value })} className={control} />
            </Field>
          </div>
          <Field id="res-url" label="Link" hint="https only. Blank is fine if there is a body.">
            <input id="res-url" value={form.url} maxLength={500} spellCheck={false}
              onChange={(e) => setForm({ ...form, url: e.target.value })} className={control}
              placeholder="https://drive.google.com/…" />
          </Field>
          <Field id="res-body" label="Body" hint="Plain sentences. HTML shows as typed, on purpose.">
            <textarea id="res-body" value={form.body} maxLength={2000} rows={3}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className={`${control} min-h-20 resize-y`} />
          </Field>
          {/* items-end, not center: the Order field is a label over an input
              and the checkbox is one line, so centring floated the checkbox
              against the taller field. Both now sit on the input row. */}
          {/* The labelled field first, then the toggle. The checkbox row
              matches the input's height (min-h-12) so items-end centres it
              against the input itself; the old order left the Order label
              floating over an empty corner with the checkbox mid-air. */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <Field id="res-order" label="Order">
              <input id="res-order" inputMode="numeric" value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: e.target.value.replace(/[^\d]/g, "") })}
                className={`${control} w-24`} />
            </Field>
            <label className="flex min-h-12 cursor-pointer items-center gap-2.5 text-sm font-semibold text-white">
              <input type="checkbox" checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                className="h-4 w-4 cursor-pointer accent-brand-gold" />
              Published
            </label>
          </div>
          {discarding ? (
            <ConfirmPanel
              label="Discard the draft"
              intent="danger"
              question="Discard what you have written?"
              consequence="This resource has not been saved, and nothing here keeps a copy."
              confirmLabel="Discard it"
              cancelLabel="Keep editing"
              onCancel={() => setDiscarding(null)}
              onConfirm={() => leave(discarding.to)}
            />
          ) : (
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={save} className={buttonClass("primary")}>
                {busy ? "Saving…" : form.id ? "Save changes" : "Add resource"}
              </button>
              <button type="button" disabled={busy} onClick={() => requestLeave("close")}
                className={buttonClass("quiet")}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </ActionDialog>
    </JobCard>
  );
}
