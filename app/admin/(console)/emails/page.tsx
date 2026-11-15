import type { Metadata } from "next";
import { isOwner, requireAdmin } from "@/lib/admin/session";
import { CREATOR_CHALLENGE, broadcastCounts } from "@/lib/admin/broadcast";
import { creatorChallengeEmail, MONICA_CREATOR_CHALLENGE_URL } from "@/lib/email/templates";
import { SAMPLE_STOP_TOKEN, stopEmailsUrl } from "@/lib/email-stop";
import { CONTACT_EMAIL } from "@/lib/constants";
import { BroadcastPanel } from "@/components/admin/broadcast-panel";
import { JobCard, Pill } from "@/components/shared/panel";

export const metadata: Metadata = {
  title: "Emails",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * One-off emails to the creators, read before they are sent (0076).
 *
 * The preview is the template itself, rendered here with a sample name, so
 * what the owner reads is what goes; the test puts it in a real inbox, where
 * the clients that render mail worst can be checked. It is framed from
 * srcdoc with every sandbox permission off: the mail's own markup runs
 * nothing and opens nothing from inside the console.
 */
export default async function EmailsPage() {
  const admin = await requireAdmin();
  if (!admin.ok) return null;

  if (!isOwner(admin.admin)) {
    return (
      <>
        <h1 className="text-display-sm font-bold uppercase tracking-[-0.03em] text-white">Owners only</h1>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-3">
          Emailing every creator is restricted to owners. Everything else in the console is open to you.
        </p>
      </>
    );
  }

  const counts = await broadcastCounts(admin.admin, CREATOR_CHALLENGE);
  const sample = creatorChallengeEmail({
    to: admin.admin.email,
    fullName: "Ada Obi",
    stopUrl: stopEmailsUrl(SAMPLE_STOP_TOKEN),
  });
  const done = counts.sent > 0 && counts.left === 0;

  return (
    <>
      <p className="eyebrow text-brand-gold">Outreach · Emails</p>
      <h1 className="mt-2 text-display-sm font-bold uppercase tracking-[-0.03em] text-white">
        Monica Creator Challenge
      </h1>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-3">
        Monica asked us to tell our creators about its ₦50 million Creator Challenge. Read it below, email
        yourself a test, then send it.
      </p>

      <div className="mt-10">
        <JobCard
          id="creator-challenge"
          title="Monica's ₦50 million Creator Challenge"
          state={done ? "done" : "now"}
          status={
            done ? (
              <Pill tone="good">Sent to {counts.sent}</Pill>
            ) : counts.sent > 0 ? (
              <Pill tone="warn">
                Sent to {counts.sent}, {counts.left} to go
              </Pill>
            ) : (
              <Pill tone="gold">Not sent</Pill>
            )
          }
          foot={<BroadcastPanel left={counts.left} sent={counts.sent} />}
        >
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-ink-3">Subject</dt>
            <dd className="font-semibold text-white">{sample.subject}</dd>
            <dt className="text-ink-3">From</dt>
            <dd className="text-ink-2">Blockfest Africa, replies to {CONTACT_EMAIL}</dd>
            <dt className="text-ink-3">Button goes to</dt>
            <dd className="break-all text-ink-2">{MONICA_CREATOR_CHALLENGE_URL}</dd>
            <dt className="text-ink-3">Goes to</dt>
            <dd className="text-ink-2">
              {counts.audience} of the {counts.registered} creators who registered: the ones who ticked
              &ldquo;tell me about future campaigns&rdquo;, leaving out disqualified accounts.
            </dd>
          </dl>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-3">
            The rest left that box unticked, and the privacy notice told them that means we will not email them
            about future campaigns. Each email carries a link to stop them, as the notice promises.
          </p>

          <iframe
            title="Preview of the email, as a creator named Ada would see it"
            srcDoc={sample.html}
            sandbox=""
            className="mt-6 h-[1180px] w-full rounded-xl border border-line bg-white"
          />

          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-ink-2 hover:text-white">
              The plain text version
            </summary>
            <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-line bg-card p-4 text-sm leading-relaxed text-ink-2">
              {sample.text}
            </pre>
          </details>
        </JobCard>
      </div>
    </>
  );
}
