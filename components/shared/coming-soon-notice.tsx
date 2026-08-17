import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface ComingSoonNoticeProps {
  /** What is being announced, e.g. "2026 lineup coming soon". */
  title: string;
  /** One line on what is on the page in the meantime. */
  description: string;
  /**
   * Where the banner sends you. Defaults to tickets, which is the right answer
   * on most pages — but a page whose content is missing *because* something is
   * still open has a better one to offer, so it can say so.
   */
  action?: { href: string; label: string };
}

/** Banner for pages showing last year's content while this year's is prepared. */
export function ComingSoonNotice({
  title,
  description,
  action = { href: "/tickets", label: "Get your ticket" },
}: ComingSoonNoticeProps) {
  return (
    <div className="border-b border-gray-200 bg-paper-muted">
      <div className="container-page flex flex-col items-start gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-blue opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-blue" />
            </span>
            {title}
          </p>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
        <Link
          href={action.href}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-brand-blue px-6 py-3 text-sm font-semibold text-white transition-colors duration-300 hover:bg-brand-blue-dark"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
