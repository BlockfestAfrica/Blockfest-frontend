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

panel.tsx owns: Panel, Pill, Stat, JobCard (spine + rail +
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

### Console jobs are contained cards

The open-edge JobCard, a job as bare text with only a 2px coloured left
rule, was re-judged against the shipped /me page and the owner called the
consoles scattered next to it. JobCard now renders as a hairline card
(border-line-2, bg-card, header and foot rows on hairlines) with the 2px
status colour kept on the card's left border. Loose admin sections
(paperwork, overview data blocks, the participants table) sit in
SectionCard for the same reason. The fill-separation objection that
justified the open edge is answered by the card border, not the fill.

### No filled gold header strips

HeadedPanel (gold-filled header bar plus gold-tinted body) is deleted, and
so is Panel's accent tone (gold left edge plus gold-tinted fill): its last
two callers were the participants award panel and the newest winners week,
and both read better as quiet with position and gold status text doing the
work. The
user rejected gold framing three separate times; the third was the week
panel on /me. Focal weight comes from position (first object after the
identity line) and from gold on the status text itself (eyebrow, clock,
submit button), never from a filled or tinted container. If a block needs a
persistent header row, it is a hairline: `border-b border-line` inside a
plain `border-line-2 bg-card` card.



- One focus voice, site-wide: the global blue ring owns :focus-visible.
  focus:border-brand-gold beside it was the double announcement the craft
  pass removed from `control`; ten survivors were swept from six files the
  first time new UI was reviewed against this document.
- No local twins of a recipe. registration-form carried its own inputClass
  and it had already drifted on three counts by review time. If a file needs
  the control recipe, it imports `control`; a divergence is a proposal to
  change the system, made here, not a private fork.

### A list of like things is one contained list, not a card each

The public Community Favourite ballot was a card per nominee: four mostly
empty boxes, "Week 1" printed on each, underlined text links with arrow
icons, and a Vote pill as wide as the card. The owner's verdict: "This is
ugly." It is now one hairline card (`border-line-2 bg-card`) with the
round's state in a header row and one row per nominee divided by
`divide-line`: the name leading, the entry as platform marks, and a
compact Vote at the row's right hand that opens the form in place. The
row's left edge carries its state (gold while voting, green once in).

- Platform links are marks, not words: fa6 icons in `rounded-full
  border-line-2` chips (PLATFORM_ICON in components/shared/platform-icon.ts,
  shared by the leaderboard, the admin picker and the ballot), each with an
  accessible name saying whose post and where.
- A fact that is true of the whole list (the week, the close time, the
  rule) is said once, above or in the list's header, never on every row.
- The same list shape holds in every state the list is shown in: before
  the open, and after the scheduled close until the round is closed in the
  console, the rows stay and only the buttons go.
- One row open at a time where the rows share one underlying action (one
  pending vote per address): opening a row closes any other.

### Signed-in sections use the ballot's anatomy

The owner approved the ballot and called the creator page and the weekly
winners ugly beside it: a card holding a bordered list holding cards, a
select and pills inside pills for the week, filled amber boxes, gold on
rank, labels, trophies and Share, and raw URLs clipping on phones. Both
are now built the way the ballot is, and new signed-in or public list
sections start from it rather than from SectionCard.

- A section is one `border-line-2 bg-card` card: a header row that says
  where it stands, once ("Week 2 · 5 days left", "335 total", "3 posts"),
  and its content as `divide-line` rows. No card, list box or panel
  inside it; a sentence is a row too.
- A row leads with a mark or with the name: a creator's own rows lead
  with the post's or account's mark, then the @handle with its status
  under it; the ballot and the winners lead with the name, the marks
  after it. Then one compact action at the right hand (Submit, Send
  again, Take back, Add, Vote), `buttonClass` at `min-w-24`; below sm a
  worded action drops under the text at its indent, so a handle keeps the
  width after the mark. A form or a question opens in place under its
  row, the row goes `border-l-brand-gold bg-card-2`, the action becomes
  Cancel, and focus returns to the action on Cancel and after a success.
  One row open at a time wherever the rows share an action.
- State lives on the row's 2px left edge and in the words, never in a
  fill: green approved, red needs a change or removed, amber a request
  waiting on the team or a failed load, gold a form open or a vote live.
  An entry waiting for review is neutral: waiting is its normal course,
  and only a pending request is amber. A notice is a titled row on its
  edge, not a warning box.
- Gold is the clock, the submit button, an open row and a live vote.
  Rank, week labels, category labels, prizes, Share and the rule line
  under a field are ink.
- Posts and accounts are marks from components/shared/platform-marks.tsx
  (MarkLink with an accessible name saying whose post and where, MarkStill
  dashed when the slot is empty), always in X, Instagram, TikTok order,
  in MARK_SLOT cells from sm up. Never a raw URL, never "Instagram ↗".
- Each fact is said once, at the level it is true of: the close time in
  the week header, the week on its group row, the total in the points
  header, who picks each award in the section hint.

### Partner walls: two groups, white tiles, hierarchy by size

The owner called the home page's sponsor section ugly: a centred title
between two rules for every category (Headline, Silver, Mobility, Media),
with one or two logos under each, and a new band for each new kind of
partner. More media, community and government partners are coming. The
fix follows what big conference sites do (TOKEN2049's partners page,
Consensus, ETHDenver, Africa Tech Summit) and was picked by eye from
three previews.

- Two groups, each a small `eyebrow` label, never a centred title between
  rules: "Sponsors", then one wall named once by the kinds it holds
  ("Media, community & government partners", from `partnerGroupLabel`).
  A new kind of partner is a line in lib/partners-2026.ts, not a section.
- Hierarchy is size and tiles per row only: the headline tile full width,
  sponsors one row fitted to their count, partners 3 / 4 / 5 / 7 per row.
  No gold ring or glow on the headline; size carries it.
- Only the headline sponsor's tile says its tier ("Headline sponsor",
  small uppercase grey under the logo). Other sponsors line up under it
  with no label, so a new one is added without deciding what to call it
  (owner, 4 October). Partners get no caption: the group label says what
  they are, once.
- Every logo, both years, sits on the same white tile (`LogoTile` in
  components/home/partner-logo.tsx) and is sized by its shape
  (`logoWeight`), so a square seal and a wide wordmark carry similar
  weight. Logo files go through scripts/logos-on-white.mjs first: it
  trims empty canvas and darkens white wordmarks drawn for dark grounds.
- Past years are the same tile, smaller and denser (8 per row), below the
  current year.

### A page that spans weeks: what is happening now, then the record

The owner saw week 1's final count twice on the winners page, one under
the other, and nothing saying which week was running. The page had a
section per kind of thing (winners, the vote), and a vote section that fell
back to the last round when none was open. It is now a page per week,
placed once, picked by eye from three previews (stacked weeks, week tabs,
now-plus-record); tabs lost because they hid the winners behind a click.

- "Happening now" (gold eyebrow, it is status) holds each live week as its
  own card: a week with a vote first, then a finished week waiting on its
  results, then the running stage. The card header names the week and its
  dates once, and its state at the right (Voting now, Votes in review,
  Awaiting results, This week).
- An award not in yet is a row saying when it comes ("Announced Sunday 4
  October"), never a promise about a day that has gone.
- The vote is the Community Favourite row of its own week, not a section:
  the ballot draws no card of its own there. The live count sits directly
  under that week's card.
- "Winners so far" is one card: a header counting the weeks announced, each
  week a group of its award rows, and that week's final count closed at its
  foot. A number is said once, with the week it belongs to.
- lib/winner-weeks.ts decides which weeks are live and which are record;
  components only draw.
