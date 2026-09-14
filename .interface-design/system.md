# Blockfest campaign interfaces: the decided system

Two humans, two tempos. A Nigerian creator on a 360px phone, checking weekly
whether their work counted and what this week asks; and two or three admins
working a review queue one-handed on launch weekend. The feel, in words that
mean something: a night-market ledger. Dark ground, one gold accent that
always means status or money, numbers that hold still, and containment you
feel rather than see.

## Tokens (defined in app/globals.css @theme)

Ground and paper existed; the pass added the tiers beneath them. Names
continue that world: ground, paper, ink, line, card.

- Ink, exactly four: `ink` #fff (leads) · `ink-2` 78% (body) ·
  `ink-3` 60% (meta, labels at rest) · `ink-4` 42% (faint, disabled).
  The census that forced this found ten ad-hoc opacities in use.
- Line, exactly three: `line` 10% (hairlines) · `line-2` 16% (controls,
  emphasis; deliberately softer than the old 20% default) · `line-3` 28%
  (the rare edge that must be found instantly).
- Surfaces, whisper steps over the ground: `card` 2% · `card-2` 5% ·
  `card-3` 9% (hover/pressed). One hue, lightness only. The recessed
  tone-on-tone card fill remains REJECTED: containment is hairline + fill,
  never darker-than-ground panels.
- `control` #071021: inputs are inset, a step DARKER than surroundings,
  because they receive content. The one surface below the ground.
- Accent: brand-gold, one accent only, meaning status or money. Links are
  `link` (AA on ground). Red only for destruction, green only for approval.

## Depth strategy

Borders-only, committed. Hairlines and surface steps, no shadows on the dark
ground. The signature is the STATUS SPINE: a 2px left edge carrying state
(gold = live/now, green = done, red = blocked, white/15 = todo) on JobCards,
queue rows, and the console rail's active item. Where a thing has a state,
the state lives on its left edge.

## Type

One family (site default). Hierarchy through weight + ink tier at few sizes,
not many sizes: value `600/ink`, label `500/ink-3`, meta `400/ink-4`.
Dynamic numbers always `tabular-nums`. Headings balance, body pretty,
antialiased root.

## Density

Console: workbench. Cards p-4, section gaps mt-6/mt-8, rows gap-2.
Creator (/me) and public product: one step airier, p-5/p-6, section mt-6,
`SPACING` map in panel.tsx is the scale. Base unit 4px, multiples only.

## Motion

Felt, not watched. `duration-150` on interactive colour/transform;
`active:scale-[0.98]` press feedback via buttonClass; transform+opacity
only; reduced-motion collapses everything (global rule exists). Nothing
repeat-use animates longer than 200ms.

## Components (use what exists)

panel.tsx owns: Panel, HeadedPanel, Pill, Stat, JobCard (spine + rail +
foot), SectionCard (contained section), PageHeader, Field, Segmented,
`control`/`selectControl` (inset), `buttonClass(intent)` with primary gold /
secondary line-2 / quiet / danger. Confirm (two-step, cancel-first) in
confirm.tsx. Extract on second reuse; never a fourth text tier by hand.

## Guard rails already in the test suite

44px tap targets · one focus ring, removals must replace · no sub-sm grids
without mobile-grid-ok · wide content scrolls in its own container · no
external script hosts in any CSP. Design changes must pass them; they have
caught real regressions from this very pass.


## Rulings from the first post-system design review (this file is why)

- One focus voice, site-wide: the global blue ring owns :focus-visible.
  focus:border-brand-gold beside it was the double announcement the craft
  pass removed from `control`; ten survivors were swept from six files the
  first time new UI was reviewed against this document.
- No local twins of a recipe. registration-form carried its own inputClass
  and it had already drifted on three counts by review time. If a file needs
  the control recipe, it imports `control`; a divergence is a proposal to
  change the system, made here, not a private fork.
