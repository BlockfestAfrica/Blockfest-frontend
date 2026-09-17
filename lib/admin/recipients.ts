import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

/**
 * The people who should hear about campaign activity.
 *
 * admin_users is the only real list of the team and nothing in the mail
 * layer read it: the single internal notification that existed went to
 * CONTACT_EMAIL, which lib/constants.ts shows is NEXT_PUBLIC_ and is
 * printed on the privacy, code-of-conduct, travel and error pages. That is
 * a published inbox, and it is also the replyTo on all 23 templates, so
 * internal alerts were landing in the same place as public enquiries and
 * every creator reply.
 *
 * Never selects password_hash. Every row carries the sentinel
 * 'netlify-identity' rather than a real hash, but a query that reaches for
 * the column is one refactor away from somewhere it should not be.
 */
export async function activeAdminEmails(
  role?: "owner" | "reviewer",
): Promise<{ email: string; fullName: string }[]> {
  const rows = await getDb().execute(
    role
      ? sql`SELECT email FROM admin_users WHERE is_active AND role = ${role}::admin_role ORDER BY email`
      : sql`SELECT email FROM admin_users WHERE is_active ORDER BY email`,
  );

  return (rows.rows ?? []).flatMap((row) => {
    const email = String((row as { email?: string }).email ?? "").trim();
    return email ? [{ email, fullName: "Blockfest campaign team" }] : [];
  });
}
