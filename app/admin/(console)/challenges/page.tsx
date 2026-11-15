import type { Metadata } from "next";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { listChallenges } from "@/lib/admin/challenges";
import { reminderState } from "@/lib/admin/reminders";
import { ChallengeEditor } from "@/components/admin/challenge-editor";
import { OwnersOnly } from "@/components/admin/owners-only";
import { PageHeader, SPACING } from "@/components/shared/panel";

export const metadata: Metadata = {
  title: "Weekly challenges",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Writing each week's challenge, announcing it and reminding the creators
 * who have nothing in. Was the middle of Campaign, under the pause switch;
 * it is the job an owner did every week, so it has its own line in the menu.
 */
export default async function ChallengesPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;
  if (!isOwner(admin.admin)) {
    return (
      <OwnersOnly
        context="Monica · Setup"
        why="A challenge announced or reminded emails every creator, so these are restricted to owners."
      />
    );
  }

  const challenges = await listChallenges(admin.admin);
  /* The deadline reminder's state, for a week that is taking entries now:
     active, opened, not yet closed. An owner can set next week active
     ahead of its Monday, and that week must not offer a reminder. */
  const now = new Date();
  const reminders = new Map(
    await Promise.all(
      challenges
        .filter((c) => c.status === "active" && c.startsAt <= now && c.endsAt > now)
        .map(async (c) => [c.id, await reminderState(admin.admin, c.id)] as const),
    ),
  );

  return (
    <div className={SPACING.page}>
      <PageHeader
        context="Monica · Setup"
        title="Weekly challenges"
        hint="Saving a week as active tells nobody. Announce it from its Edit form once it is live, and remind the creators with nothing in before it closes."
      />
      <ChallengeEditor
        challenges={challenges.map((challenge) => ({
          id: challenge.id,
          weekNo: challenge.weekNo,
          title: challenge.title,
          description: challenge.description,
          question: challenge.question,
          focus: challenge.focus,
          skills: challenge.skills,
          basePoints: challenge.basePoints,
          status: challenge.status,
          startsAt: challenge.startsAt.toISOString(),
          endsAt: challenge.endsAt.toISOString(),
          readonly_: challenge.endsAt < new Date(),
          reminder: reminders.get(challenge.id),
        }))}
      />
    </div>
  );
}
