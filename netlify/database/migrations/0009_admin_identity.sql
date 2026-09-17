-- Bind Netlify Identity accounts to admin rows, and make revocation mean
-- something.
--
-- Identity answers one question well: which verified email address is signed
-- in. It does not answer whether that person is still an admin. Roles live in
-- the nf_jwt, that token is valid for about an hour, and stripping a role does
-- not invalidate tokens already issued. So an admin whose laptop is stolen
-- keeps working for up to an hour against the surface that decides how
-- 5,000,000 naira is split.
--
-- So the JWT is used only for identity, never for authorisation. Whether
-- somebody counts as an admin is a row here, read on every request. Revoking is
-- one UPDATE and it takes effect on the next click.

ALTER TABLE admin_users
  -- Netlify's own user id, bound the first time that address signs in.
  ADD COLUMN IF NOT EXISTS identity_user_id text,
  ADD COLUMN IF NOT EXISTS identity_bound_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS revoked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

-- One Identity account cannot back two admin rows.
CREATE UNIQUE INDEX IF NOT EXISTS admin_identity_user_unique
  ON admin_users (identity_user_id)
  WHERE identity_user_id IS NOT NULL;

-- Revocation has to be answerable after the fact: who, when, and why.
ALTER TABLE admin_users
  DROP CONSTRAINT IF EXISTS admin_revocation_timed;

ALTER TABLE admin_users
  ADD CONSTRAINT admin_revocation_timed
  CHECK (
    (is_active = true  AND revoked_at IS NULL) OR
    (is_active = false AND revoked_at IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- Deleting an admin is never the right operation.
--
-- Every foreign key pointing here is ON DELETE SET NULL: audit_log,
-- point_ledger, point_rules, resources, submissions and votes. So a single
-- DELETE FROM admin_users silently strips that person's name from every
-- approval they ever made, every point they awarded and every audit row, while
-- leaving the points themselves in place. The ledger would still say the money
-- was earned and nothing would say who decided it.
--
-- There is no case where that is wanted. Somebody leaving is a revocation.

CREATE OR REPLACE FUNCTION refuse_admin_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'admin_users rows are never deleted: every approval, point award and audit row references them ON DELETE SET NULL, so deleting one anonymises history. Revoke instead: UPDATE admin_users SET is_active = false, revoked_at = now(), revoked_reason = ''...'' WHERE id = %.',
    OLD.id
    USING ERRCODE = 'P0301';
END $$;

DROP TRIGGER IF EXISTS admin_users_no_delete ON admin_users;

CREATE TRIGGER admin_users_no_delete
  BEFORE DELETE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION refuse_admin_delete();

-- ---------------------------------------------------------------------------
-- Resolve a signed-in Identity user to an admin row.
--
-- One statement, so the lookup and the first-use binding cannot race each
-- other, and so there is exactly one place that decides who is an admin.
--
-- The binding is trust on first use: the first time an invited address signs
-- in, its Netlify user id is recorded, and from then on BOTH have to match.
-- Registration is invite only, so the first sign-in for an address is the
-- person we invited. After binding, an account that later acquires the same
-- address cannot inherit the row, and neither can the same account after
-- changing address.
--
-- Returns nothing at all for anybody who is not a current admin. No distinction
-- between unknown, revoked and mismatched, because a caller that can tell those
-- apart is a caller that can enumerate admins.

CREATE OR REPLACE FUNCTION resolve_admin(
  p_email       text,
  p_identity_id text
)
RETURNS TABLE (admin_id uuid, admin_role admin_role)
LANGUAGE plpgsql AS $$
DECLARE
  v_email text := lower(btrim(p_email));
  a       admin_users%ROWTYPE;
BEGIN
  IF v_email = '' OR p_identity_id IS NULL OR btrim(p_identity_id) = '' THEN
    RETURN;
  END IF;

  SELECT * INTO a FROM admin_users
   WHERE email_canonical = v_email
   FOR UPDATE;

  IF a.id IS NULL OR NOT a.is_active THEN
    RETURN;
  END IF;

  IF a.identity_user_id IS NULL THEN
    UPDATE admin_users
       SET identity_user_id = p_identity_id,
           identity_bound_at = now(),
           last_seen_at = now()
     WHERE id = a.id;
  ELSIF a.identity_user_id <> p_identity_id THEN
    -- The address matches an admin but the account behind it does not. Someone
    -- else's account now carries this address, or this row was already bound to
    -- a different one. Either way it is not the person we invited.
    RETURN;
  ELSE
    UPDATE admin_users SET last_seen_at = now() WHERE id = a.id;
  END IF;

  admin_id := a.id;
  admin_role := a.role;
  RETURN NEXT;
END $$;

-- ---------------------------------------------------------------------------
-- The named admins.
--
-- Rows, not constants, so the list changes with one statement and no deploy.
-- password_hash is NOT NULL and unused: authentication is delegated to
-- Identity, so a sentinel records that rather than a hash of anything. It can
-- never match a password because no hashing scheme produces this string.

INSERT INTO admin_users (email, email_canonical, password_hash, role, is_active)
VALUES
  ('partnership@blockfestafrica.com', 'partnership@blockfestafrica.com',
   'netlify-identity', 'owner', true),
  ('heedris2olubisi@gmail.com', 'heedris2olubisi@gmail.com',
   'netlify-identity', 'owner', true)
ON CONFLICT (email_canonical) DO NOTHING;
