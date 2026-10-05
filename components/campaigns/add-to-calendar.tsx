import { CalendarPlus } from "lucide-react";
import { monicaRoutes, monicaStages } from "@/lib/campaigns";
import { googleDeadlineUrl } from "@/lib/stage-calendar";

/**
 * "Add the deadline to your calendar", for a stage's close.
 *
 * Google Calendar opens an add-event page; the file works for Apple and
 * Outlook and carries alerts a day and three hours before (see
 * lib/stage-calendar.ts). A calendar alert on a phone is what an email read
 * after noon was not.
 */
export function AddToCalendar({ weekNo, className = "" }: { weekNo: number; className?: string }) {
  const stage = monicaStages.find((s) => s.number === weekNo);
  if (!stage) return null;
  const link =
    "inline-flex min-h-11 items-center font-semibold text-link underline underline-offset-2 hover:text-white";
  return (
    <p className={`flex flex-wrap items-center gap-x-3 text-sm text-ink-3 ${className}`}>
      <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Add the deadline to your calendar:</span>
      <a href={googleDeadlineUrl(stage)} target="_blank" rel="noopener noreferrer" className={link}>
        Google Calendar
      </a>
      <a href={monicaRoutes.deadlines} className={link}>
        Apple or Outlook
      </a>
    </p>
  );
}
