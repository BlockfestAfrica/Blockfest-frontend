# /getdp: the Blockfest Africa 2026 DP generator

A person picks how they are coming (attending, speaking, volunteering,
partner), types their name, adds a photo and moves it in the frame, then
downloads a 2160×2160 PNG or shares it. The design is concept C, "New trade
routes", picked by the owner on 9 October 2026; `.interface-design/system.md`
records what is fixed about it.

The photo never leaves the device: it is read into a canvas in the tab and
drawn there. The only things this folder loads are the site's own logo
images, and it sends nothing: `__tests__/unit/privacy.test.ts` fails if a
request call appears anywhere in it, because the privacy policy says the
photo is never uploaded.

## Files

- `page.tsx`: server component. Metadata, JSON-LD, the page header, and the
  footer logos handed to the generator.
- `components/DPGenerator.tsx`: the client UI. Role, name, photo (picker or
  drop), drag / arrow keys / zoom / reset, a live preview drawn at 1080, and
  Download and Share drawing the full 2160.
- `lib/dp.ts`: every rule as plain data and arithmetic, no canvas: role
  copy and colours, name checks and line breaks, the public days, share text,
  file name, crop maths, footer tiers and footer and art layout. Unit tested
  in `__tests__/unit/getdp-dp.test.ts`.
- `lib/draw.ts`: `drawDP(ctx, options, assets)`, the canvas painting. No
  React. Refuses to draw until Bebas Neue and Gotham have loaded.
- `lib/letters.ts`: how a name is spelt in Bebas's own letters (recomposed
  accents, dots below, borrowed marks, plain stand-ins), and which letters
  the page must mention or refuse. Pure; tested in
  `__tests__/unit/getdp-letters.test.ts`.
- `lib/fonts.ts`: Bebas Neue via next/font (self-hosted; the CSP allows only
  the site's own fonts) and the site's Gotham.
- `lib/load.ts`: loading the mark and rasterising partner logos at their
  recorded sizes; reading the photo, with the messages a person sees when a
  file will not open (HEIC outside Safari, for one).
- `lib/tiers.server.ts`: the footer tiers from `lib/partners-2026.ts`, with
  SVG logos given their size on their root element so every browser can draw
  them.

## Changing what is on the picture

- **A sponsor or partner**: add a line to `lib/partners-2026.ts`. It appears
  on the picture with no change here: the headline sponsor centred, other
  sponsors either side (and, once the sides are full, on a line under it),
  with ecosystem partners after them in the same row and no label. Then, in
  a smaller second row, the government under "Endorsed by", and community
  and media partners as one list of logos with no heading.
- **The days and venues**: `publicDays` on `blockfest2026Lagos` in
  `lib/events.ts`, drawn as stops on one line; `short` is the venue's name
  as that line says it. Public days only; the private mixer on the 24th
  never goes there.
- **The mark**: `DP_LOGO_SRC` in `lib/dp.ts`. The drawing reads the new file's
  own proportions.
- **Role wording or colours**: `ROLE_COPY` in `lib/dp.ts`.
