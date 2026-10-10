# /getdp: the Blockfest Africa 2026 DP generator

A person picks how they are coming (attending, speaking, volunteering,
partner) and a design from two dropdowns, types their name, adds a photo and
moves it in the frame, then shares the 2160×2160 picture through their
phone's share list or saves it (a PNG download, or press and hold where
downloads fail).

**Designs** (`lib/looks.ts`). "Trade routes" is concept C, picked by the
owner on 9 October 2026, and stays the default: people were already posting
it. "Wave crown" and "Colour fields" come from the 2026 brand kit the design
team shared on 10 October (the four colours, the wave pattern, the colour
fields, the mark on a card); the owner picked them from three to offer as
choices. Every design shares one layout (`layoutArt`), so the photo frame,
the name's sizing, the days and the partners' band are the same in each, and
only the ground, the decoration and the colours change.
`.interface-design/system.md` records what is fixed about concept C.

The photo never leaves the device: it is read into a canvas in the tab and
drawn there, and neither the photo nor the name is ever sent. The only
things this folder loads are the site's own fonts and logo images. It sends
two kinds of thing, each carrying a role and, where there is one, how the DP
left the page, and nothing else:

- The count. When a DP is first downloaded, shared or saved, `lib/count.ts`
  tells `/api/getdp/generated` its role and channel, and the admin overview
  counts the rows. `__tests__/unit/privacy.test.ts` fails if any other
  request call appears in this folder, or if that one carries anything but
  the role and the channel, because the privacy policy says so (version 1.1,
  "Badge count").
- Three Sabilytics events, through `track()` in `lib/sabilytics.ts`
  (`GETDP_EVENTS`): `getdp_dp_made` with the role, once a visit when a
  picture is first ready; `getdp_dp_generated` with the role and channel, at
  the same moment as the count; and `getdp_share_clicked` with the role and
  channel, on every save or share tap. The policy covers these under
  Analytics.

**Counting.** A DP counts as generated once a visit for each photo as each
role, at the moment it leaves the page: a share the person went through with
(a share list they closed is not counted), a download that started, or the
press-and-hold picture opening (a save from there cannot be seen). Fixing a
letter of the name or the crop is the same DP, and so is going back to a
role already counted; a new photo or a new role is a new one. Each counted
DP is a row in `dp_generations` (migration 0072), which the admin overview
totals for all time, today in Lagos, by role and by channel. The database
count is the one to report: an ad blocker stops the Sabilytics events, not
the row.

## Files

- `page.tsx`: server component. Metadata, JSON-LD, the page header, and the
  footer logos handed to the generator.
- `components/DPGenerator.tsx`: the client UI and every browser call. Role,
  name, photo (picker or drop), drag from the photo's circle / pinch / arrow
  keys / zoom / reset, a live preview drawn at 1080 (and, on a phone, its
  role-name-days band as a strip above the name field), the full 2160 drawn
  ahead and kept per picture, and the share, download and copy handlers.
- `components/ShareActions.tsx`: the save and share buttons this device
  gets, the status line, the "Post it on" marks and the caption with Copy.
  Draws only; no navigator calls.
- `components/InAppNotice.tsx`: the note above the steps in an app's
  browser (Instagram, TikTok, Facebook, LinkedIn): Open in Chrome on
  Android, Copy link everywhere.
- `components/HoldToSave.tsx`: the finished PNG as a plain picture in a
  dialog, to press and hold where downloads and the share list fail.
- `lib/share.ts`: which device this is, which buttons it gets, what each
  platform's mark does there, what goes to the share list, and every
  sentence about saving and sharing. Pure; tested in
  `__tests__/unit/getdp-share.test.ts`.
- `lib/dp.ts`: every rule as plain data and arithmetic, no canvas: role
  copy and colours, name checks and line breaks, the public days, share text,
  file name, crop maths, footer tiers and footer and art layout. Unit tested
  in `__tests__/unit/getdp-dp.test.ts`.
- `lib/draw.ts`: `drawDP(ctx, options, assets)`, the canvas painting. No
  React. Refuses to draw until Bebas Neue and Gotham have loaded, and draws
  in nothing else (`lib/faces.ts`).
- `lib/letters.ts`: how a name is spelt in Bebas's own letters (recomposed
  accents, dots below, borrowed marks, plain stand-ins), and which letters
  the page must mention or refuse. Pure; tested in
  `__tests__/unit/getdp-letters.test.ts`.
- `lib/fonts.ts`: Bebas Neue via next/font (self-hosted; the CSP allows only
  the site's own fonts) and the site's Gotham.
- `lib/faces.ts`: the two faces the DP draws in, loaded by the page itself.
  It reads where next/font's @font-face rules put the files and loads each
  as a FontFace under a family only the DP uses ("Blockfest DP Display",
  "Blockfest DP Text"). The CSS faces are never asked for: next/font puts a
  "… Fallback" face whose only source is `local("Arial")` behind each, and
  Android has no Arial, so any `document.fonts.load()` that names that
  family rejects on every Android phone (#312). A try that fails or runs
  past 12 seconds is forgotten and the next one asks for the file under a
  new URL (`?dp=N`), so Try again works after a failed or stalled download,
  which a CSS face never does. Files that loaded are not asked for again.
  It starts as the page opens, beside the logos. Tested in
  `__tests__/unit/getdp-faces.test.ts`.
- `lib/load.ts`: loading the mark and rasterising partner logos at their
  recorded proportions (at most 1200 on the long side); reading the photo,
  with the messages a person sees when a file will not open (HEIC outside
  Safari, for one). A logo that takes over 8 seconds is left off the
  footer at first, then asked for again in the background (twice, 30
  seconds each, under a new URL), and the picture is drawn again with each
  one that comes: on slow data, the smaller partners' logos used to drop off
  for good. A mark that takes over 12 seconds ends in "Try again", as fonts
  that take over 12 do in `lib/faces.ts`. Try again keeps the role, name and photo. A
  name's letter check that times out with the fonts keeps saving shut (a
  letter the face cannot draw must never reach a picture) and also ends in
  "Try again", which runs the check again.
- `lib/tiers.server.ts`: the footer tiers from `lib/partners-2026.ts`, with
  SVG logos given their size on their root element so every browser can draw
  them.

## Changing what is on the picture

- **A sponsor or partner**: add a line to `lib/partners-2026.ts`. It appears
  on the picture with no change here (unless marked `onDp: false`, which
  keeps it on the website's wall only): the headline sponsor centred, other
  sponsors either side (and, once the sides are full, on a line under it),
  with ecosystem partners after them in the same row and no label. Then, in
  a smaller second row, the government under "Endorsed by", and community
  and media partners as one list of logos with no heading.
- **The days and venues**: `publicDays` on `blockfest2026Lagos` in
  `lib/events.ts`, drawn as stops on one line; `short` is the venue's name
  as that line says it. Public days only; the private mixer on the 24th
  never goes there.
- **The mark**: the brand kit's official files (10 October), `DP_LOGO_SRC`
  (white lettering, for the dark designs) and `DP_MARK_LIGHT_SRC` (black
  lettering, for "Colour fields") in `lib/dp.ts`. The drawing reads each
  file's own proportions.
- **A design**: `LOOKS` and `drawLookGround` in `lib/looks.ts`; add its id to
  `DP_STYLES` and a name to `STYLE_LABEL`.
- **Role wording or colours**: `ROLE_COPY` in `lib/dp.ts`.

## Sharing and saving

**What a website can and cannot do.** Links to X, LinkedIn and TikTok carry
text, never a picture: X's intent link has no media parameter, LinkedIn's
share link takes a URL only, and TikTok's web upload page takes nothing
from a link.
Their posting APIs want the picture uploaded to a server first, and the
privacy rule (the photo never leaves the device) forbids that. So nothing
can be posted or uploaded for anybody, and no sentence on the page may say
or suggest it. The one way to hand the picture straight to an app is the
phone's share list: `navigator.share` with the file, from which the person
picks X, TikTok, LinkedIn, Instagram, WhatsApp or Save Image. Everywhere
else the page is honest that it is a few steps: it saves the DP, copies the
caption, opens the site, and says "attach your DP". `lib/share.ts` holds
every one of those sentences, and its test fails on any that claims
otherwise.

**Four kinds of device** (`deviceClass` in `lib/share.ts`), decided once
after the page loads; until then it renders as a desktop, with everything
shut until there is a picture:

| Class | Who | Gold button | Others | The marks (X, Instagram, TikTok, LinkedIn, WhatsApp) |
|---|---|---|---|---|
| sheet (A) | a phone whose share list takes the file: Safari and every browser on iOS, Chrome and Samsung Internet on Android, iOS app browsers that keep it | Share your DP | iOS: Save to Photos, Download PNG (quiet). Android: Download PNG | each opens the share list; the caption is copied; a tip says what to pick |
| download (B) | a phone browser that cannot share files: Firefox Android, Opera, UC, iOS Lockdown Mode | Download PNG | iOS: Save to Photos (press and hold) | X, LinkedIn, WhatsApp are links that also save and copy; TikTok and Instagram save, copy and say how to post. On iOS each copies the caption and opens the press-and-hold picture instead (`marksClass`): a download there goes to Files, where the apps' photo pickers never look |
| hold (C) | an app's browser that cannot share files: every Android WebView (Instagram, Facebook, TikTok, LinkedIn) | Save image (press and hold) | none: downloads are what fail there | each copies the caption and opens the press-and-hold picture |
| desktop (D) | a fine pointer | Download PNG | Share… (quiet) where the browser shares files | real links in a new tab that also download the PNG and copy the caption |

**WhatsApp Status** has its own button on a phone, under the save buttons
(`statusAction`). No link opens My status, so on a phone whose share list
takes the file the button opens it with the picture and says to choose
WhatsApp, then My status, which WhatsApp puts first in the list of where to
send it. Where the list cannot take the file, it saves the DP (press and hold
on an iPhone or in an app's browser) and says where Status is: Updates, then
My status. A desktop does not show it; Status is posted from the phone.

**Formats.** The share list gets a JPEG at 0.92 on a phone (about a fifth
of the PNG's 3 to 4 MB, quicker to make, and inside X's 5 MB limit; the
platforms recompress it anyway). Download is always the PNG.

**Drawn ahead, shared inside the tap.** Browsers open the share list only
inside a tap, and Safari is strict about it. So the full picture is drawn
300 ms after the last change (one render at a time; a queued render whose
picture has since changed is skipped, and one whose picture changes while
it is drawing is dropped), and a tap on Share hands the ready file to
`navigator.share` without waiting on anything. If the file is not ready yet
the button says "Preparing…" and shares when it is; if Safari then refuses,
or the person changes the picture while it is preparing, the page says "Tap
again" and the second tap is immediate. Neither a share nor a download ever
hands over a picture the person has since changed. "Tap again" and "Sharing
didn't work" go as soon as the share list opens.
On iOS the share gets the file alone (text hides Save Image and makes some
apps take the words instead of the picture); on Android it gets the caption
beside the file when the browser accepts it (`captionTravels`). The caption
is copied to the clipboard in the same tap, since LinkedIn and Instagram
drop it, except for X, WhatsApp and WhatsApp Status where it already goes
with the picture (`copiesCaption`): there a copy would only be a second,
needless one, and Android shows "Copied" for it.

**In an app's browser** a note above the steps says what may not work and
how to get out (Open in Chrome on Android through an `intent://` link,
Copy link everywhere), before anything is typed. Download is hidden there;
saving is the press-and-hold picture.

**Still to check on real devices before merge** (none of this can run in
CI): Share opening the list inside the tap on an iPhone (iOS 17 and 18),
including the first tap straight after a drag; which apps keep the image
and caption; Save Image landing in Photos; Download going to Files on iOS
and Downloads on Android; pinching with the second finger off the photo's
circle (Safari's handling of multi-touch touch-action); long-press saving
in the Instagram, TikTok and Facebook browsers on iOS and Android; whether
the `intent://` link opens Chrome from inside those apps (if one shows an
error page, remove that button; the note's words still hold); whether
`tiktok.com/tiktokstudio/upload` takes a photo post on a desktop (if not,
give TikTok the "save" behaviour); whether `wa.me/?text=` with no number
opens the chat picker; Safari's download prompt when a desktop mark is
clicked before the PNG is ready; that Enter brings the picture up only once
the keyboard is down (it waits for the screen's resize, at most a second);
and that the name strip shows above the name field with the keyboard up on
a phone held sideways.

**Left for later**: shrinking very large photos while decoding them (a
48 MP photo is still decoded at full size first), a HEIC decoder for
Android, a 9:16 picture for TikTok.
