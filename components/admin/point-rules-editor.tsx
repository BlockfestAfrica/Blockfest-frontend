"use client";

import { useState, useEffect } from "react";
import { reveal } from "@/components/shared/reveal";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buttonClass, control, JobCard } from "@/components/shared/panel";

export interface RuleRow {
  id: string;
  key: string;
  defaultPoints: number;
  minPoints: number | null;
  maxPoints: number | null;
}

/** What each key means to the person editing it, in their words. */
const LABELS: Record<string, { name: string; note?: string }> = {
  multi_platform_bonus_2: { name: "Second platform bonus", note: "Added to the week's base when the same entry is approved on a second platform." },
  multi_platform_bonus_3: { name: "Third platform bonus", note: "Added to the week's base for all three. Replaces the second platform bonus, not stacked on it." },
  referral: { name: "Referral", note: "Paid to the referrer when the creator they brought in has their first approved entry." },
  quality_bonus: { name: "Quality bonus" },
  engagement_milestone: { name: "Engagement milestone" },
  featured_blockfest: { name: "Featured by Blockfest" },
  featured_monica: { name: "Featured by Monica" },
  collab: { name: "Collaboration" },
  wildcard_win: { name: "Wildcard win" },
  manual_adjustment: { name: "Manual adjustment", note: "The catch-all, deliberately the tightest." },
  manual_total_cap: { name: "Manual award ceiling", note: "The most one creator can hold from ALL hand awards combined. The max column is the cap." },
  entry_base: { name: "Entry base (legacy)", note: "No longer read: since 0037 the base lives on each week, edited in the challenges above." },
};

/**
 * Every point value, editable (#68).
 *
 * Two rails carry the trust here, and the card states both. Changes are
 * forward-only by construction, because entries snapshot their rates at
 * creation; and repricing an existing entry is a separate, deliberate act on
 * the Tools screen, never a side effect of editing a number here.
 */
export function PointRulesEditor({
  rules,
  weekBase,
}: {
  rules: RuleRow[];
  /** The current week's base, for the tier totals readout. */
  weekBase: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ def: "", min: "", max: "" });

  const bonus2 = rules.find((r) => r.key === "multi_platform_bonus_2")?.defaultPoints ?? 0;
  const bonus3 = rules.find((r) => r.key === "multi_platform_bonus_3")?.defaultPoints ?? 0;

  /*
   * The inputs stack on a phone, so Save for a lower rule could land below
   * the fold with nothing to show the Edit press did anything. Bring the
   * opened fields into view and start in the first one.
   */
  useEffect(() => {
    if (!open) return;
    const fields = document.getElementById(`rule-edit-${open}`);
    reveal(fields, fields?.querySelector<HTMLElement>("input"));
  }, [open]);

  function startEditing(rule: RuleRow) {
    setOpen(rule.id);
    setForm({
      def: String(rule.defaultPoints),
      min: rule.minPoints === null ? "" : String(rule.minPoints),
      max: rule.maxPoints === null ? "" : String(rule.maxPoints),
    });
  }

  async function save(rule: RuleRow) {
    const num = (value: string) => (value.trim() === "" ? null : Number(value));
    setBusy(true);
    try {
      const response = await fetch("/api/admin/point-rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: rule.id,
          defaultPoints: num(form.def),
          minPoints: num(form.min),
          maxPoints: num(form.max),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      toast.success(`${LABELS[rule.key]?.name ?? rule.key} saved. Applies to entries from now on.`);
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
      id="point-values"
      title="Point values"
      state="todo"
      hint="Changes reach entries created from now on and never touch anything already awarded: entries snapshot their rates when they are made. Bringing an old entry to new rates is its own deliberate act, on the Tools screen. The public campaign page states the tier ladder in its copy, so if you change a tier bonus, the page copy has to move with it."
    >
      {/* The tiers as absolute totals, which is how the team reasons about
          them: "a three platform entry is worth X", never stacking deltas. */}
      <div className="mb-6 rounded-lg border border-line p-4">
        <p className="text-sm font-semibold text-white">This week, an approved entry is worth</p>
        {/* mobile-grid-ok: three numerals with one-word labels. */}
        <div className="mt-3 grid grid-cols-3 gap-4 text-center">
          {[
            { label: "1 platform", total: weekBase },
            { label: "2 platforms", total: weekBase + bonus2 },
            { label: "3 platforms", total: weekBase + bonus3 },
          ].map((tier) => (
            <div key={tier.label}>
              <p className="text-2xl font-bold tabular-nums text-white">{tier.total}</p>
              <p className="mt-1 text-sm text-ink-3">{tier.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-3">
          The base is set per week in the challenges above; the two bonuses below
          are campaign-wide.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {rules.map((rule) => {
          const meta = LABELS[rule.key] ?? { name: rule.key };
          const legacy = rule.key === "entry_base";
          return (
            <li key={rule.id} className={`rounded-lg border border-line p-4 ${legacy ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-semibold text-white">{meta.name}</span>
                <span className="text-sm tabular-nums text-ink-2">
                  {rule.defaultPoints}
                  {rule.minPoints !== null || rule.maxPoints !== null
                    ? ` (${rule.minPoints ?? "no floor"} to ${rule.maxPoints ?? "no ceiling"})`
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={() => (open === rule.id ? setOpen(null) : startEditing(rule))}
                  aria-expanded={open === rule.id}
                  className="ml-auto inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-semibold text-ink-3 transition-colors hover:text-white"
                >
                  {open === rule.id ? "Cancel" : "Edit"}
                </button>
              </div>
              {meta.note && (
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-3">{meta.note}</p>
              )}

              {open === rule.id && (
                <div
                  id={`rule-edit-${rule.id}`}
                  className="mt-3 grid scroll-mb-6 gap-3 sm:grid-cols-3"
                >
                  {(
                    [
                      ["def", "Points"],
                      ["min", "Floor (blank for none)"],
                      ["max", "Ceiling (blank for none)"],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field} className="flex flex-col gap-1">
                      <label htmlFor={`${field}-${rule.id}`} className="text-sm font-semibold text-white">
                        {label}
                      </label>
                      <input
                        id={`${field}-${rule.id}`}
                        inputMode="numeric"
                        value={form[field]}
                        onChange={(event) =>
                          setForm({ ...form, [field]: event.target.value.replace(/[^\d-]/g, "") })
                        }
                        className={control}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => save(rule)}
                    className={buttonClass("primary", "w-fit sm:col-span-3")}
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </JobCard>
  );
}
