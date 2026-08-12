# Web Analytics

The site uses [Sabilytics](https://www.sabilytics.com) for web analytics. It
replaced Umami in August 2026.

## Why the change mattered

The Umami setup recorded nothing. Its script tag carried
`data-auto-track="false"`, which disables automatic pageview collection, and the
initialiser that was supposed to compensate called `window.umami.pageView()` — a
method that does not exist in the Umami client. On top of that, `/insights` wrote
`localStorage["umami.disabled"] = "true"` into the browser of anyone who opened
it, silencing tracking site-wide for that visitor from then on.

Worth remembering when wiring up any analytics tool: confirm events actually
arrive in the dashboard before trusting the integration.

## How it is wired

One script tag in [`app/layout.tsx`](../app/layout.tsx):

```tsx
<script
  async
  src={SABILYTICS_SRC}
  data-site={SABILYTICS_SITE_ID}
  data-domain={SABILYTICS_DOMAIN}
/>
```

Pageviews are automatic. There is nothing to configure and no environment
variable to set — the site id and domain are public values and live in
[`lib/sabilytics.ts`](../lib/sabilytics.ts).

The Content Security Policy in [`next.config.ts`](../next.config.ts) allows
`https://www.sabilytics.com` in `script-src` and `connect-src`. Changing
analytics providers means changing that policy too, or the script is blocked
silently.

## Custom events

`lib/sabilytics.ts` wraps `window.sabilytics.track` so callers never touch the
global directly and nothing throws if the script is blocked or still loading:

```ts
import { trackTicketIntent, trackButtonClick } from "@/lib/sabilytics";

trackTicketIntent("Hero - Primary CTA"); // fires on every ticket link
trackButtonClick("Add to calendar", "hero");
```

`track(event, data)` is available for anything that does not fit those two.

## Attribution

Ticket links do not just fire an event, they carry UTM parameters through to the
checkout. `ticketUrl(source)` in [`lib/tickets.ts`](../lib/tickets.ts) stamps
every outbound link with `utm_source`, `utm_medium`, `utm_campaign` and a
`utm_content` derived from where on the site it was clicked. That is what tells
you which section actually sells passes, since the sale itself completes on
Meetumo where site analytics cannot follow.

## The other dashboard

`/insights` is unrelated. It is a password-gated view of guest registrations read
from a published Google Sheet, and has nothing to do with web analytics. Its
source URL contains attendee personal data and belongs in `.env.local` only,
never in `.env.example`.
