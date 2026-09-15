import type { Metadata } from "next";
import Link from "next/link";
import { RecoverAccessForm } from "@/components/campaigns/recover-access-form";
import { monicaRoutes } from "@/lib/campaigns";
import { buttonClass } from "@/components/shared/panel";

export const metadata: Metadata = {
  title: "Get back into your campaign page",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * "Lost your link?" Closes #206, successor to #78.
 *
 * Everything a creator on this page can do is ask; nothing here signs
 * anybody in or changes anything, which is why the copy leads with that. The
 * admin reissue tool in app/api/admin/creator-link/route.ts stays as the
 * fallback for when mail delivery itself is the problem.
 */
export default function RecoverAccessPage() {
  return (
    <main id="main" className="bg-ground">
      <section className="section-y">
        <div className="container-page max-w-xl">
          <p className="eyebrow text-brand-gold">Monica</p>
          <h1 className="mt-2 text-display-sm font-bold uppercase tracking-[-0.03em] text-pretty text-white">
            Lost your link?
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-2">
            Type the email address you registered with. If it is registered,
            we will send a link to that address to confirm it is you and get
            you a fresh one. Nothing happens until you click that link.
          </p>

          <div className="mt-6">
            <RecoverAccessForm />
          </div>

          <p className="mt-8 text-sm leading-relaxed text-ink-3">
            If you never received or lost the email address you registered
            with, write to{" "}
            <a
              href="mailto:partnership@blockfestafrica.com"
              className="text-link underline underline-offset-2 hover:text-white"
            >
              partnership@blockfestafrica.com
            </a>{" "}
            and a person will help.
          </p>

          <div className="mt-8">
            <Link href={monicaRoutes.landing} className={buttonClass("secondary")}>
              Back to the campaign
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
