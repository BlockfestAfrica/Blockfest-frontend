-- Server-minted admin sessions, so no admin credential lives where page
-- script can read it (issue #138).
--
-- Netlify Identity keeps its JWT in document.cookie (path=/, not httpOnly) and
-- its refresh token in localStorage, on an origin the public site shares with a
-- vendor analytics tag. Script anywhere on blockfestafrica.com could lift a
-- credential that renews itself forever. Every mitigation shipped so far, no
-- eval, tag exclusions, sign-out, the recovery gate, narrows that; none closes
-- it, and the recovery gate is actively undone by the library's own refresh
-- timer re-planting the cookies a moment after they are cleared.
--
-- From here the Identity credential is spent once, server side, at sign-in.
-- What the browser holds afterwards is an opaque token in an httpOnly cookie,
-- and its SHA-256 is a row in this table. Tokens are minted in Node
-- (lib/admin/session-token.ts), exactly like the creator access tokens,
-- because PGlite runs the integration suite and has no pgcrypto. The database
-- only ever sees the hash, so reading this table is not holding a session.
--
-- Authorization stays live and stays where 0009 put it. Every request still
-- resolves the admin row and checks is_active, so revoking is one UPDATE and
-- applies on the next click:
--
--   UPDATE admin_users SET is_active = false, revoked_at = now(),
--          revoked_reason = '...' WHERE email_canonical = '...';
--
-- and the trigger below now also deletes that admin's live sessions in the
-- same statement. Deleting a user in the Netlify Identity UI alone does NOT
-- end a live session; after this change nothing consults Identity once signed
-- in, so it only stops future sign-ins. The one-UPDATE revoke is the kill
-- switch. If the shared inbox owner is feared compromised, that flip ends every
-- machine at once; reactivate after re-securing.

CREATE TABLE IF NOT EXISTS "admin_sessions" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_id"     uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  -- SHA-256 hex of a 32-byte token minted in Node. UNIQUE as the lookup index
  -- and so a hash collision is an error rather than a silent takeover.
  "token_hash"   text NOT NULL UNIQUE,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "expires_at"   timestamptz NOT NULL,
  "last_seen_at" timestamptz NOT NULL DEFAULT now()
  -- No client address, no user agent: nothing would read them, and this
  -- codebase does not store personal data nothing reads.
);

CREATE INDEX IF NOT EXISTS admin_sessions_admin ON admin_sessions (admin_id);

-- ---------------------------------------------------------------------------
-- The once-per-sign-in exchange.
--
-- resolve_admin (last defined in 0012, deliberately NOT redefined here) is
-- called, not copied, so trust-on-first-use binding and its audit rows happen
-- on this path too and stay defined in one place.
--
-- Returns no row for every failure: unknown address, revoked, bound to a
-- different Netlify account, malformed hash. A caller who can tell those apart
-- can enumerate admins. It raises nothing, so the PGlite/neon-http divergence
-- over RAISE never applies and the lineage guard sees an empty raise set.

CREATE OR REPLACE FUNCTION create_admin_session(
  p_email       text,
  p_identity_id text,
  p_token_hash  text
)
RETURNS TABLE (admin_id uuid, admin_role admin_role, admin_email text, expires_at timestamptz)
LANGUAGE plpgsql AS $$
DECLARE
  r         RECORD;
  v_expires timestamptz;
  v_email   text;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;

  SELECT * INTO r FROM resolve_admin(p_email, p_identity_id);
  IF r.admin_id IS NULL THEN
    RETURN;
  END IF;

  SELECT a.email_canonical INTO v_email FROM admin_users a WHERE a.id = r.admin_id;

  -- Expired rows are dead weight; two admins keep this tiny.
  DELETE FROM admin_sessions s WHERE s.expires_at <= now();

  -- Keep the newest four so this insert makes five. The shared inbox on two
  -- machines plus retries fits; a stolen password cannot grow the table without
  -- bound. Pruned by last_seen_at, so the idle session goes first.
  DELETE FROM admin_sessions s
   WHERE s.admin_id = r.admin_id
     AND s.id NOT IN (
       SELECT s2.id FROM admin_sessions s2
        WHERE s2.admin_id = r.admin_id
        ORDER BY s2.last_seen_at DESC
        LIMIT 4
     );

  -- Twelve hours, absolute, no renewal and no sliding. The defect being fixed
  -- is a credential that renews forever; a sliding window would rebuild that
  -- for a cookie thief. Twelve hours covers a launch-day shift, and signing in
  -- again is typing one password.
  v_expires := now() + interval '12 hours';

  INSERT INTO admin_sessions (admin_id, token_hash, expires_at)
  VALUES (r.admin_id, p_token_hash, v_expires);

  admin_id    := r.admin_id;
  admin_role  := r.admin_role;
  admin_email := v_email;
  expires_at  := v_expires;
  RETURN NEXT;
END $$;

-- ---------------------------------------------------------------------------
-- Every authenticated request. One call answers who this is, that the session
-- has not expired, and that the admin is still active, and records liveness on
-- both rows, atomically.

CREATE OR REPLACE FUNCTION touch_admin_session(
  p_token_hash text
)
RETURNS TABLE (admin_id uuid, admin_role admin_role, admin_email text, expires_at timestamptz)
LANGUAGE plpgsql AS $$
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE admin_sessions s
     SET last_seen_at = now()
    FROM admin_users a
   WHERE s.token_hash = p_token_hash
     AND s.expires_at > now()
     AND a.id = s.admin_id
     AND a.is_active
  RETURNING a.id, a.role, a.email_canonical, s.expires_at;

  -- Keep admin_users.last_seen_at meaning "last seen", as resolve_admin did
  -- when it ran every request. Same transaction, so it cannot disagree with
  -- the row returned above.
  UPDATE admin_users a
     SET last_seen_at = now()
   WHERE a.id IN (
     SELECT s.admin_id FROM admin_sessions s WHERE s.token_hash = p_token_hash
   );
END $$;

-- ---------------------------------------------------------------------------
-- Revoking an admin ends their consoles in the same statement, so the one
-- UPDATE that has been the runbook since 0009 needs no second step learned
-- under pressure.

CREATE OR REPLACE FUNCTION end_admin_sessions_on_revoke()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM admin_sessions WHERE admin_sessions.admin_id = NEW.id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS admin_sessions_end_on_revoke ON admin_users;

CREATE TRIGGER admin_sessions_end_on_revoke
  AFTER UPDATE OF is_active ON admin_users
  FOR EACH ROW
  WHEN (OLD.is_active AND NOT NEW.is_active)
  EXECUTE FUNCTION end_admin_sessions_on_revoke();
