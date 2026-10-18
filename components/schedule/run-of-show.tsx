import type { ReactNode } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import {
  isSplit,
  runOfShow2026,
  sessionLength,
  type RunDay,
  type RunPeople,
  type RunSession,
  type RunSplit,
  type SessionKind,
} from "@/lib/run-of-show-2026";
import { is2026Speaker, SpeakersList, speakerSlug } from "@/lib/speakers";

/** Sheet names that are the same person as a 2026 speaker profile. */
const NAME_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["Dr. Maruf Olatunji Alausa", "Dr. Tunji Alausa"],
  ["Xploit", "Achebo Edwin (Xploit)"],
  ["Ayomide Shodipo", "Shodipo Ayomide"],
  ["Achusi Amara", "Amara Achusi"],
  ["Crypto Oracle", "Abdulsamad Tiamiyu (Crypto Oracle)"],
];

const PROFILES = SpeakersList.filter(is2026Speaker)
  .flatMap((s) => {
    const href = `/speakers/${speakerSlug(s.name)}`;
    const aliases = NAME_ALIASES.filter(([, canonical]) => canonical === s.name).map(([sheet]) => sheet);
    return [s.name, ...aliases].map((name) => ({ name, href }));
  })
  .sort((a, b) => b.name.length - a.name.length);

/** Turn a names line into text with profile links for anyone on the 2026 lineup. */
function LinkedNames({ text }: { text: string }) {
  type Part = { t: string; href?: string };
  let parts: Part[] = [{ t: text }];
  for (const person of PROFILES) {
    const next: Part[] = [];
    for (const part of parts) {
      if (part.href) {
        next.push(part);
        continue;
      }
      const at = part.t.indexOf(person.name);
      if (at < 0) {
        next.push(part);
        continue;
      }
      if (at > 0) next.push({ t: part.t.slice(0, at) });
      next.push({ t: person.name, href: person.href });
      if (at + person.name.length < part.t.length) {
        next.push({ t: part.t.slice(at + person.name.length) });
      }
    }
    parts = next;
  }
  return (
    <>
      {parts.map((part, i) =>
        part.href ? (
          <Link
            key={i}
            href={part.href}
            className="font-medium text-brand-blue underline-offset-2 hover:underline"
          >
            {part.t}
          </Link>
        ) : (
          <span key={i}>{part.t}</span>
        ),
      )}
    </>
  );
}

/** Programme content wears the brand blue; everything that supports it stays quiet. */
const CONTENT: ReadonlySet<SessionKind> = new Set([
  "welcome",
  "address",
  "keynote",
  "panel",
  "fireside",
  "talk",
  "workshop",
  "masterclass",
]);

const KIND_NAME: Record<SessionKind, string> = {
  welcome: "Welcome",
  address: "Address",
  keynote: "Keynote",
  panel: "Panel",
  fireside: "Fireside chat",
  talk: "Lightning talk",
  workshop: "Workshop",
  masterclass: "Masterclass",
  break: "Break",
  networking: "Networking",
  sponsor: "Sponsor",
  entertainment: "Entertainment",
  host: "On stage",
  closing: "Closing",
  logistics: "Logistics",
};

const dayName = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

function Chip({ kind, children }: { kind: SessionKind; children: ReactNode }) {
  const style = CONTENT.has(kind)
    ? "bg-brand-blue/10 text-brand-blue"
    : "border border-gray-200 bg-paper-muted text-gray-600";
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${style}`}
    >
      {children}
    </span>
  );
}

function People({ people }: { people?: RunPeople[] }) {
  if (!people?.length) return null;
  return (
    <dl className="mt-3 space-y-1 text-sm">
      {people.map((line) => (
        <div key={line.label} className="flex flex-wrap gap-x-2">
          <dt className="font-semibold text-gray-900">{line.label}:</dt>
          <dd className="text-gray-600">
            <LinkedNames text={line.names} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Time({ start, end, date }: { start: string; end: string; date: string }) {
  return (
    <div className="shrink-0 sm:w-28">
      <time
        dateTime={`${date}T${start}`}
        className="text-base font-bold tabular-nums text-gray-900"
      >
        {start}
      </time>
      <span className="text-sm tabular-nums text-gray-500">
        {" "}
        <span aria-hidden="true">to</span>
        <span className="sr-only">until</span>{" "}
        <time dateTime={`${date}T${end}`}>{end}</time>
      </span>
      <p className="text-xs text-gray-500">{sessionLength(start, end)}</p>
    </div>
  );
}

function SessionRow({ session, date }: { session: RunSession; date: string }) {
  const content = CONTENT.has(session.kind);
  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:gap-6">
      <Time start={session.start} end={session.end} date={date} />
      {content ? (
        <div className="flex-1 rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-brand-blue">
          <div className="flex flex-wrap items-center gap-2">
            <Chip kind={session.kind}>{session.label ?? KIND_NAME[session.kind]}</Chip>
            {session.place && <span className="text-xs text-gray-500">{session.place}</span>}
          </div>
          <h3 className="mt-3 text-lg font-bold leading-snug text-gray-900">{session.title}</h3>
          {session.detail && <p className="mt-1 text-sm text-gray-600">{session.detail}</p>}
          <People people={session.people} />
        </div>
      ) : (
        <div className="flex-1 rounded-xl bg-paper-muted px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip kind={session.kind}>{session.label ?? KIND_NAME[session.kind]}</Chip>
            {session.place && <span className="text-xs text-gray-500">{session.place}</span>}
          </div>
          <h3 className="mt-2 text-base font-semibold text-gray-900">{session.title}</h3>
          {session.detail && <p className="mt-1 text-sm text-gray-600">{session.detail}</p>}
          <People people={session.people} />
        </div>
      )}
    </li>
  );
}

function SplitRow({ split, date }: { split: RunSplit; date: string }) {
  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:gap-6">
      <Time start={split.start} end={split.end} date={date} />
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Chip kind={split.kind}>{split.label}</Chip>
          <span className="text-xs text-gray-500">Two rooms, at the same time</span>
        </div>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {split.tracks.map((track) => (
            <li
              key={track.room}
              className="rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-brand-blue"
            >
              <p className="eyebrow text-brand-blue">{track.room}</p>
              <h4 className="mt-2 text-lg font-bold leading-snug text-gray-900">{track.title}</h4>
              <People people={track.people} />
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function Day({ day }: { day: RunDay }) {
  return (
    <section
      id={day.id}
      aria-labelledby={`${day.id}-heading`}
      className="scroll-mt-24"
    >
      <p className="eyebrow text-brand-blue">
        {day.name} · {dayName(day.date)}
      </p>
      <h2
        id={`${day.id}-heading`}
        className="text-display-sm mt-3 font-bold text-gray-900"
      >
        {day.theme}
      </h2>
      <p className="mt-3 flex items-center gap-2 text-base font-medium text-gray-600">
        <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
        {day.venue}, Lagos
      </p>

      <ol className="mt-8 space-y-4">
        {day.blocks.map((block) =>
          isSplit(block) ? (
            <SplitRow key={`${block.start}-${block.label}`} split={block} date={day.date} />
          ) : (
            <SessionRow key={`${block.start}-${block.title}`} session={block} date={day.date} />
          ),
        )}
      </ol>
    </section>
  );
}

/** The 2026 run of show: a jump link per day, then each day hour by hour. */
export function RunOfShow() {
  return (
    <div>
      <nav aria-label="Jump to a day" className="mb-12 flex flex-wrap gap-3">
        {runOfShow2026.map((day) => (
          <a
            key={day.id}
            href={`#${day.id}`}
            className="inline-flex min-h-11 items-center rounded-full border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-900 transition-colors hover:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
          >
            {day.name} · {shortDay(day.date)}
          </a>
        ))}
      </nav>

      <div className="space-y-20">
        {runOfShow2026.map((day) => (
          <Day key={day.id} day={day} />
        ))}
      </div>
    </div>
  );
}
