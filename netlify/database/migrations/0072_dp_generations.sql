/*
 * How many DPs have been made on /getdp.
 *
 * One row each time a person first downloads, shares or saves their DP:
 * which role it says (attending, speaking, volunteering, partner) and how it
 * left the page (Download PNG, the phone's share list, an app's mark,
 * WhatsApp Status, Save image). The admin overview counts the rows; there is
 * no counter column, for the reason lib/admin/metrics.ts gives.
 *
 * Nothing here is personal. No name, no photograph, no address, no device or
 * visitor identifier: the DP is made in the browser and its photograph never
 * leaves it (lib/privacy.ts). The route throttles by connection the way every
 * public form does, in request_throttle, and keeps nothing of it here.
 *
 * Not Monica campaign data, so purge_campaign_data leaves it alone
 * (__tests__/integration/purge.test.ts lists it as kept, with why).
 *
 * The two lists below must match DP_ROLES (app/getdp/lib/dp.ts) and
 * DP_CHANNELS (app/getdp/lib/count.ts); __tests__/integration/dp-generations.test.ts
 * fails when they drift. A new role or channel needs a new migration.
 */
CREATE TABLE dp_generations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  role       text NOT NULL,
  channel    text NOT NULL,
  CONSTRAINT dp_generations_role
    CHECK (role IN ('attendee', 'speaker', 'volunteer', 'partner')),
  CONSTRAINT dp_generations_channel
    CHECK (channel IN (
      'download', 'share', 'more', 'photos', 'save', 'status',
      'x', 'instagram', 'tiktok', 'linkedin', 'whatsapp'
    ))
);

CREATE INDEX dp_generations_created_at ON dp_generations (created_at);
