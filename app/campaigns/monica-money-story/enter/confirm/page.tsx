import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { CREATOR_PENDING_COOKIE, CREATOR_SESSION_COOKIE } from "@/lib/creator-access";
import { creatorByToken, handlesForEnrolment } from "@/lib/creator-session";
import { monicaRoutes } from "@/lib/campaigns";
import { buttonClass } from "@/components/shared/panel";
import { enterAsPending, discardPending } from "./actions";

export const metadata: Metadata = {
  title: "Open your dashboard",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Whose account is this link about to open.
 *
 * The question this page exists to ask used to be skipped entirely: clicking a
 * link set a ninety day session for whoever the link belonged to, so a creator
 * who tapped somebody else's link in a group chat became that person without
 * being told. The name below is the whole fix. A creator seeing a stranger's
 * name stops; a creator seeing their own taps through.
 *
 * The token is never rendered here. It stays in an httpOnly cookie and the
 * server action reads it back, so nothing on the page, including the analytics
 * script, can see it.
 */
export default async function ConfirmEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  const jar = await cookies();

  /*
   * Read only from the cookie.
   *
   * Netlify re-appends the original query string to a redirect, so a token can
   * arrive in this page's URL whether or not anybody meant it to. Ignoring the
   * query entirely is what stops that from being a second way in.
   */
  const pending = jar.get(CREATOR_PENDING_COOKIE)?.value?.trim() ?? "";

  let holder: Awaited<ReturnType<typeof creatorByToken>> = null;
  let unavailable = false;
  if (pending) {
    try {
      holder = await creatorByToken(pending);
    } catch {
      unavailable = true;
    }
  }

  const current = jar.get(CREATOR_SESSION_COOKIE)?.value?.trim() ?? "";
  let signedInAs: string | null = null;
  if (current && current !== pending) {
    try {
      signedInAs = (await creatorByToken(current))?.name ?? null;
    } catch {
      signedInAs = null;
    }
  }

  /*
   * The handles, because a name alone vouches for nothing. Registration does
   * not make names unique, so an attacker can register under the exact name a
   * victim expects to see. Handles are unique per platform and are what a
   * person recognises as theirs; a victim reading a stranger's @handle under
   * their own name stops.
   */
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
              {/* break-words for the same reason /me dropped its display
                  size: a long single-token name at the 30px clamp floor
                  overruns a 328px box and html/body clip, never scroll. */}
              <h1 className="mt-2 break-words text-display-sm font-bold uppercase tracking-[-0.03em] text-pretty text-white">
                Open the dashboard for {holder!.name}
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

              {signedInAs ? (
                /*
                 * The case that used to happen silently, and the reason the
                 * name is the first thing on the page. Stated as a swap rather
                 * than as a warning, because for two creators sharing a phone
                 * it is the ordinary thing to do and not a problem.
                 */
                <p className="mt-4 text-base leading-relaxed text-ink-2">
                  You are signed in as {signedInAs}. Continuing swaps this
                  browser over to {holder!.name} and signs {signedInAs} out. If
                  that is not what you expected, this link belongs to somebody
                  else and you should not continue.
                </p>
              ) : (
                <p className="mt-4 text-base leading-relaxed text-ink-2">
                  If that is not your name, or those are not your accounts,
                  this link belongs to somebody else.
                  Do not continue: anything you submit would be filed under
                  their account and counted as their work.
                </p>
              )}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <form action={enterAsPending}>
                  {/* The enrolment the page displayed, so the action can refuse
                      to sign in anybody other than the account named above. An
                      id is not a credential; the token stays in its cookie. */}
                  <input type="hidden" name="enrolment" value={holder!.enrolmentId} />
                  <button type="submit" className={buttonClass("primary", "w-full sm:w-auto")}>
                    Yes, I am {holder!.name}
                  </button>
                </form>
                <form action={discardPending}>
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

/** Every way this page is reached without a live claim to confirm. */
function Problem({ kind }: { kind: string }) {
  const COPY: Record<string, { title: string; body: string }> = {
    unknown: {
      title: "That link does not work",
      body: "It may have been retyped, cut short by the app that sent it, or replaced by a newer one. Only the most recent link we sent you works, because issuing a new one switches the old one off.",
    },
    expired: {
      title: "That link has expired",
      body: "Links wait ten minutes between being opened and being confirmed. Open the link in your welcome email again and it will bring you straight back here.",
    },
    unavailable: {
      title: "We could not check that link",
      body: "Something at our end did not answer, which is not a problem with your link. Wait a moment and open it again.",
    },
  };
  // Own-property only. Without this a crafted ?s=__proto__ resolves to the
  // truthy Object prototype rather than falling through to expired, and the
  // page renders an empty heading.
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
      <p className="mt-4 text-base leading-relaxed text-ink-2">
        If you cannot find the email, write to{" "}
        <a
          href="mailto:partnership@blockfestafrica.com"
          className="text-link underline underline-offset-2 hover:text-white"
        >
          partnership@blockfestafrica.com
        </a>{" "}
        from the address you registered with and we will issue a new link.
      </p>
      <div className="mt-8">
        <Link href={monicaRoutes.landing} className={buttonClass("secondary")}>
          Back to the campaign
        </Link>
      </div>
    </>
  );
}
