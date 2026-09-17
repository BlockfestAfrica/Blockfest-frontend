import type { Metadata } from "next";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { adminRoster } from "@/lib/admin/admins";
import { PageHeader, Pill, SectionCard, SPACING } from "@/components/shared/panel";
import { dateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Admins",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Who has console access, and who is using it right now.
 *
 * The roster is set by migration and has never been readable outside psql,
 * so "who can see the review queue" was a question the console could not
 * answer about itself. On a campaign holding five million naira that is
 * worth a screen.
 *
 * Read only, on purpose, and not a limitation to be fixed later. Access is
 * granted by a migration and a deploy, which means a code review and a
 * record in git. Putting an Add admin button here would move that behind a
 * single click available to whoever is signed in, including somebody signed
 * in with a stolen session, and the first thing an attacker would do with
 * console access is grant themselves a second way back in. A page that can
 * only tell you the truth cannot be turned against you.
 *
 * Owners only, matching the audit log and for the same reason: it names
 * admins, and the answer to "who has access" is about the people this page
 * is restricted to.
 */
export default async function AdminsPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  if (!isOwner(admin.admin)) {
    return (
      <PageHeader
        context="Admins"
        title="Owners only"
        hint="This page names every admin and shows whose access is live, so reading it is owner work."
      />
    );
  }

  const roster = await adminRoster(admin.admin);
  const owners = roster.filter((a) => a.role === "owner" && a.isActive).length;
  const signedIn = roster.filter((a) => a.liveSessions > 0).length;

  return (
    <div className={SPACING.page}>
      <PageHeader
        context="Admins"
        title="Who has console access"
        hint={`${roster.length} ${roster.length === 1 ? "account" : "accounts"}, ${owners} with the owner role, ${signedIn} signed in now.`}
      />

      <SectionCard id="roster" title="The roster">
        <p className="mb-4 max-w-prose text-sm leading-relaxed text-ink-2">
          Access is granted in a migration, so it costs a code review and a
          deploy. Nothing on this page changes it.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th scope="col" className="py-2 pr-4 font-semibold">Admin</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Role</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Access</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Signed in</th>
                <th scope="col" className="py-2 font-semibold">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((row) => (
                <tr key={row.adminId} className="border-b border-line last:border-b-0">
                  <td className="py-3 pr-4">
                    <span className="font-semibold text-white">{row.email}</span>
                    {row.isYou && (
                      <span className="ml-2 text-ink-4">you</span>
                    )}
                    <span className="block text-ink-4">
                      added {dateTime(row.createdAt)}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {row.role === "owner" ? (
                      <Pill tone="gold">Owner</Pill>
                    ) : (
                      <Pill>Reviewer</Pill>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {row.isActive ? (
                      <Pill tone="good">Active</Pill>
                    ) : (
                      <Pill tone="bad">Revoked</Pill>
                    )}
                  </td>
                  <td className="py-3 pr-4 tabular-nums text-ink-2">
                    {row.liveSessions > 0
                      ? `${row.liveSessions} ${row.liveSessions === 1 ? "session" : "sessions"}`
                      : "No"}
                  </td>
                  <td className="py-3 text-ink-2">
                    {row.lastSeenAt ? dateTime(row.lastSeenAt) : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard id="how-access-works" title="How access is granted">
        <div className={`max-w-prose ${SPACING.related}`}>
          <p className="text-sm leading-relaxed text-ink-2">
            An admin is added by a migration and a deploy. That is slower than
            a button on this page, deliberately: it means every grant is
            reviewed by a second person and recorded in the repository, and it
            means somebody who reaches the console with a stolen session
            cannot grant themselves a second way back in.
          </p>
          <p className="text-sm leading-relaxed text-ink-2">
            <span className="font-semibold text-white">Owner</span> can
            announce winners, run the vote, edit the campaign and read the
            audit log.{" "}
            <span className="font-semibold text-white">Reviewer</span> works
            the submission queue. Both decide real money, so every action
            either takes lands in the audit log beside their name.
          </p>
          <p className="text-sm leading-relaxed text-ink-2">
            A session lasts twelve hours. If somebody here should no longer
            have access, revoking it is a migration too, and their sessions
            go with the row.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
