-- Make the first binding of an admin account visible, and recoverable.
--
-- resolve_admin binds whatever Netlify account first presents an admin address,
-- and afterwards refuses every other account forever. That is the right shape:
-- registration is invite only, so the first sign-in for an address is the person
-- who was invited.
--
-- What was wrong is that it happened silently and could not be undone. An owner
-- who signed in once on the wrong Netlify account, which is an ordinary mistake
-- and needs no attacker at all, locked themselves out of their own row
-- permanently. And they could not tell: every failure collapses to one answer,
-- correctly, so the page says "you need to sign in" whether the row is taken or
-- Identity is simply down.
--
-- So the binding now writes an audit row. Nothing about the HTTP response
-- changes, because a caller who can distinguish these can enumerate admins. It
-- is the operator who gains the ability to see what happened.
--
-- Unbinding stays a deliberate manual act, and is now written down where
-- somebody looking for it will find it:
--
--   UPDATE admin_users SET identity_user_id = NULL, identity_bound_at = NULL
--    WHERE email_canonical = '...';
--
-- That is safe precisely because it is not reachable from the application.

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

    -- The moment an address becomes an account. Recorded because it happens
    -- once, decides everything afterwards, and previously left no trace.
    INSERT INTO audit_log (actor_admin_id, action, entity_type, entity_id, after, note)
    VALUES (
      a.id, 'admin.identity_bound', 'admin_user', a.id,
      jsonb_build_object('identity_user_id', p_identity_id),
      'First sign-in bound this Netlify account to the admin row. Every later sign-in must present the same account.'
    );

  ELSIF a.identity_user_id <> p_identity_id THEN
    -- Somebody presented an admin address from an account that is not the one
    -- bound to it. Refused, and worth seeing: it is either a mistake worth
    -- explaining or an attempt worth knowing about. actor_admin_id is null
    -- because whoever did this is not the admin.
    INSERT INTO audit_log (actor_admin_id, action, entity_type, entity_id, after, note)
    VALUES (
      NULL, 'admin.identity_mismatch', 'admin_user', a.id,
      jsonb_build_object('presented_identity_user_id', p_identity_id),
      'An admin address was presented from a Netlify account it is not bound to. Access refused.'
    );
    RETURN;

  ELSE
    UPDATE admin_users SET last_seen_at = now() WHERE id = a.id;
  END IF;

  admin_id := a.id;
  admin_role := a.role;
  RETURN NEXT;
END $$;
