"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buttonClass, control, Field, JobCard, Pill } from "@/components/shared/panel";

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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function startEditing(row: ResourceRow) {
    setForm({
      id: row.id,
      section: row.section,
      title: row.title,
      body: row.body ?? "",
      url: row.url ?? "",
      displayOrder: String(row.displayOrder),
      isPublished: row.isPublished,
    });
    setOpen(true);
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
      hint="Links and notes on the public pack page, live within a minute of saving, no deploy. Plain text only: anything that looks like HTML renders as the characters themselves, on purpose. Links must be https."
    >
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-line bg-card p-4">
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
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-semibold text-ink-3 transition-colors hover:text-white"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(row.id)}
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-semibold text-red-300/80 transition-colors hover:text-red-300"
                >
                  Delete
                </button>
              </span>
            </div>
            {row.url && <p className="mt-1 break-all font-mono text-sm text-ink-3">{row.url}</p>}
          </li>
        ))}
        {rows.length === 0 && (
          <li className="text-sm text-ink-3">Nothing yet. Add the first one below.</li>
        )}
      </ul>

      {open ? (
        <div className="mt-4 flex flex-col gap-4 rounded-lg border border-line p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="res-title" label="Title">
              <input id="res-title" value={form.title} maxLength={160}
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
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-white">
              <input type="checkbox" checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                className="h-4 w-4 cursor-pointer accent-brand-gold" />
              Published
            </label>
            <Field id="res-order" label="Order">
              <input id="res-order" inputMode="numeric" value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: e.target.value.replace(/[^\d]/g, "") })}
                className={`${control} w-24`} />
            </Field>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={save} className={buttonClass("primary")}>
              {busy ? "Saving…" : form.id ? "Save changes" : "Add resource"}
            </button>
            <button type="button" onClick={() => { setOpen(false); setForm(EMPTY); }}
              className={buttonClass("quiet")}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary", "mt-4 w-fit")}>
          Add a resource
        </button>
      )}
    </JobCard>
  );
}
