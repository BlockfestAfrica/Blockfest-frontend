import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface ComingSoonNoticeProps {
  /** What is being announced, e.g. "2026 lineup coming soon". */
  title: string;
  /** One line on what is on the page in the meantime. */
  description: string;
}

/** Banner for pages showing last year's content while this year's is prepared. */
export function ComingSoonNotice({ title, description }: ComingSoonNoticeProps) {
  return (
    <div className="bg-gray-50 border-b border-gray-200">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div>
          <p className="flex items-center gap-2 font-semibold text-gray-900">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-blue opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-blue" />
            </span>
            {title}
          </p>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
        <Link
          href="/tickets"
          className="inline-flex shrink-0 items-center gap-2 min-h-11 rounded-full bg-brand-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-pressed"
        >
          Get your ticket
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
