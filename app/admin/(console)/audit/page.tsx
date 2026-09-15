import type { Metadata } from "next";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { auditTrail } from "@/lib/admin/audit";
import { AuditTable } from "@/components/admin/audit-table";
import { PageHeader, SectionCard, SPACING } from "@/components/shared/panel";
import { dateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Audit log",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Who did what, when, on one screen.
 *
 * The engine has written this trail since the first migration: every award,
 * announcement, pause, sweep and correction lands in audit_log inside the
 * same transaction as the act, with the admin who did it. What was missing
 * was a way to read it that was not psql. Owners only, because the trail
 * names admins and includes actions a reviewer cannot take; the answer to
 * "which admin did this" is by definition about the people this page is
 * restricted to.
 */
export default async function AuditPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  if (!isOwner(admin.admin)) {
    return (
      <PageHeader
        context="Audit log"
        title="Owners only"
        hint="The trail names admins and the actions only owners can take, so reading it is owner work too."
      />
    );
  }

  const trail = await auditTrail(admin.admin);

  return (
    <div className={SPACING.page}>
      <PageHeader
        context="Monica"
        title="Audit log"
        hint="Every admin action, written by the engine in the same transaction as the act. Newest first; filter by action, admin, or a word from a note."
      />

      <SectionCard id="trail">
        <AuditTable
          rows={trail.map((row) => ({
            id: row.id,
            action: row.action,
            entityType: row.entityType,
            adminEmail: row.adminEmail,
            note: row.note,
            afterJson: row.after ? JSON.stringify(row.after, null, 1) : null,
            dateLabel: dateTime(row.createdAt),
          }))}
        />
      </SectionCard>
    </div>
  );
}
