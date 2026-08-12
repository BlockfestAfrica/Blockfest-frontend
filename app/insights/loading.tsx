import { LoadingPage } from "@/components/ui/loading";

/**
 * Scoped to /insights only.
 *
 * This used to live at app/loading.tsx, which put a Suspense boundary around
 * every route on the site. With JavaScript disabled — a no-JS visitor, or any
 * agent that renders rather than parses — the public pages showed nothing but
 * this spinner, because the fallback only swaps for the real content once JS
 * runs. The internal dashboard genuinely needs the boundary; the marketing
 * site does not.
 */
export default function Loading() {
  return <LoadingPage message="Loading insights..." />;
}
