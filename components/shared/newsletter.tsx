import Link from "next/link";

export { SUBSTACK_URL } from "@/lib/newsletter";
import { SUBSTACK_URL } from "@/lib/newsletter";

/**
 * Substack signup.
 *
 * Sits in the footer, so it is on every page. Until now the site had no way at
 * all to hear from someone who was not ready to buy today, which matters when
 * two thirds of traffic arrives with no referrer and may never come back.
 *
 * The iframe is lazy and carries explicit width/height so it reserves its space
 * instead of shifting the footer when it loads. Substack ships it at a fixed
 * 480px; it is capped to the container here so it fits a 320px phone.
 */
export function Newsletter() {
  return (
    <div>
      <p className="text-base font-semibold text-white">
        Get the Blockf3st newsletter
      </p>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-nav-gray">
        Speaker drops, agenda news and ticket deadlines. No spam.
      </p>

      <div className="mt-5 w-full max-w-[480px] overflow-hidden rounded-lg">
        <iframe
          src={`${SUBSTACK_URL}/embed`}
          title="Subscribe to the Blockf3st Africa newsletter"
          width={480}
          height={320}
          loading="lazy"
          scrolling="no"
          className="block h-[320px] w-full border-0 bg-white"
        />
      </div>

      <p className="mt-3 text-sm text-nav-gray">
        Or{" "}
        <Link
          href="/newsletter"
          className="text-link underline underline-offset-2 hover:text-white"
        >
          read past issues
        </Link>
        .
      </p>
    </div>
  );
}
