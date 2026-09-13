-- Give marketing@blockfestafrica.com a console account.
--
-- Being invited in the Netlify Identity dashboard is only half of what this
-- codebase requires. Identity answers "which verified address is signed in";
-- authorisation is a row in admin_users, read live on every request, which is
-- what makes revoking one UPDATE instead of a wait for a token to expire.
--
-- With the Identity half done and this half missing, the symptom is confusing
-- in a specific and costly way: the invite accepts, the password sets, sign-in
-- at Identity succeeds, and then /admin renders "You need to sign in to see
-- this" and a Sign in button, which sends the person back to the form they just
-- used. It reads exactly like a rejected password. That is what happened to
-- marketing@blockfestafrica.com.
--
-- Reviewer, not owner. A reviewer approves and rejects entries and awards
-- bonuses, which is the job. An owner also announces winners, which commits
-- prize money to a named person, and that should be a deliberate grant rather
-- than the default for everybody who is added. Change 'reviewer' to 'owner'
-- here if that is wanted.
--
-- password_hash is the literal 'netlify-identity' every seeded row carries: no
-- password is ever stored here, because Identity holds it.
--
-- Adding the next admin is this file again with a different address. That does
-- not scale and it should not stay true; an owner-only screen for adding and
-- revoking admins is the right answer and is worth building after launch.

INSERT INTO admin_users (email, email_canonical, password_hash, role, is_active)
VALUES (
  'marketing@blockfestafrica.com',
  'marketing@blockfestafrica.com',
  'netlify-identity',
  'reviewer',
  true
)
ON CONFLICT (email_canonical) DO NOTHING;
