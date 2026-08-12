/**
 * /insights is a private, password-gated dashboard. It publishes no structured
 * data at all — the previous version emitted a public Dataset node advertising
 * internal registration statistics, which is exactly what a noindex page should
 * not do. Kept as a named component so the page reads explicitly.
 */
export function InsightsSchema() {
  return null;
}
