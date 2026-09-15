import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { CREATOR_RECOVERY_PENDING_COOKIE, CREATOR_SESSION_COOKIE } from "@/lib/creator-access";
import { recoveryHolderByToken } from "@/lib/creator-recovery";
import { creatorByToken, handlesForEnrolment } from "@/lib/creator-session";
import { monicaRoutes } from "@/lib/campaigns";
import { buttonClass } from "@/components/shared/panel";
import { confirmRecovery, discardRecoveryPending } from "./actions";

export const metadata: Metadata = {
  title: "Confirm it was you",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The question a self-service recovery link exists to ask. Closes #206.
 *
 * The same reasoning as #78's entry-confirm page, for a second token: the
 * name is shown so a creator who did not request this, or clicked somebody
 * else's forwarded mail, stops here instead of silently handing their
 * account to whoever sent it. What is different from that page is what
 * confirming DOES: this one rotates the access token, so the copy says so
 * plainly rather than only naming the account.
 */
export default async function ConfirmRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  const jar = await cookies();

  const pending = jar.get(CREATOR_RECOVERY_PENDING_COOKIE)?.value?.trim() ?? "";

  let holder: Awaited<ReturnType<typeof recoveryHolderByToken>> = null;
  let unavailable = false;
  if (pending) {
    try {
      holder = await recoveryHolderByToken(pending);
    } catch {
      unavailable = true;
    }
  }

  const current = jar.get(CREATOR_SESSION_COOKIE)?.value?.trim() ?? "";
  let signedInAs: string | null = null;
  if (current) {
    try {
      signedInAs = (await creatorByToken(current))?.name ?? null;
    } catch {
      signedInAs = null;
    }
  }

  let handles: Array<{ platform: string; handle: string }> = [];
  if (holder) {
    try {
      handles = await handlesForEnrolment(holder.enrolmentId);
    } catch {
      handles = [];
    }
  }

  const problem = unavailable || s === "unavailable" ? "unavailable" : !holder ? (s ?? "expired") : null;

  return (
    <main id="main" className="bg-ground">
      <section className="section-y">
        <div className="container-page max-w-xl">
          {problem ? (
            <Problem kind={problem} />
          ) : (
            <>
              <p className="eyebrow text-brand-gold">Monica</p>
              <h1 className="mt-2 break-words text-display-sm font-bold uppercase tracking-[-0.03em] text-pretty text-white">
                Get {holder!.name} back in?
              </h1>

              {handles.length > 0 && (
                <ul className="mt-4 space-y-1">
                  {handles.map((h) => (
                    <li
                      key={`${h.platform}-${h.handle}`}
                      className="text-sm text-ink-2"
                    >
                      <span className="uppercase tracking-wider text-ink-4">
                        {h.platform}
                      </span>{" "}
                      <span className="font-mono [overflow-wrap:anywhere]">@{h.handle}</span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-4 text-base leading-relaxed text-ink-2">
                Confirming replaces this account&apos;s link with a new one
                and signs you in. The old link stops working right after.
              </p>

              {signedInAs ? (
                <p className="mt-4 text-base leading-relaxed text-ink-2">
                  You are signed in as {signedInAs}. Continuing swaps this
                  browser over to {holder!.name} and signs {signedInAs} out. If
                  that is not what you expected, do not continue.
                </p>
              ) : (
                <p className="mt-4 text-base leading-relaxed text-ink-2">
                  If that is not your name, or those are not your accounts,
                  this link belongs to somebody else. Do not continue.
                </p>
              )}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <form action={confirmRecovery}>
                  <input type="hidden" name="enrolment" value={holder!.enrolmentId} />
                  <button type="submit" className={buttonClass("primary", "w-full sm:w-auto")}>
                    Yes, get me back in
                  </button>
                </form>
                <form action={discardRecoveryPending}>
                  <button type="submit" className={buttonClass("quiet", "w-full sm:w-auto")}>
                    This is not me
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function Problem({ kind }: { kind: string }) {
  const COPY: Record<string, { title: string; body: string }> = {
    expired: {
      title: "That link has expired or was already used",
      body: "A recovery link works once and only for thirty minutes. Ask for a new one from the campaign page.",
    },
    unavailable: {
      title: "We could not check that link",
      body: "Something at our end did not answer, which is not a problem with your link. Wait a moment and open it again.",
    },
  };
  const { title, body } = Object.prototype.hasOwnProperty.call(COPY, kind)
    ? COPY[kind]
    : COPY.expired;

  return (
    <>
      <p className="eyebrow text-brand-gold">Monica</p>
      <h1 className="mt-2 text-display-sm font-bold uppercase tracking-[-0.03em] text-pretty text-white">
        {title}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-ink-2">{body}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href={monicaRoutes.recover} className={buttonClass("primary", "w-full sm:w-auto")}>
          Ask for a new link
        </Link>
        <Link href={monicaRoutes.landing} className={buttonClass("secondary", "w-full sm:w-auto")}>
          Back to the campaign
        </Link>
      </div>
    </>
  );
}
