import { ChevronDown, Clock, MapPin } from "lucide-react";
import { DaySwitch, type DayTab } from "@/components/schedule/day-switch";
import { LinkedNames } from "@/components/schedule/linked-names";
import { RoomScope, SplitTracks } from "@/components/schedule/room-scope";
import {
  homePlace,
  labelSaid,
  quietName,
  roomNumber,
  roomOf,
  roomsOf,
  segmentsOf,
  type Segment,
} from "@/lib/run-of-show-layout";
import {
  isSplit,
  runOfShow2026,
  type RunDay,
  type RunPeople,
  type RunSession,
  type RunSplit,
  type SessionKind,
} from "@/lib/run-of-show-2026";

/**
 * The 2026 run of show on /schedule: one day at a time.
 *
 * Picked by eye by the owner from three previews on 19 October 2026 (the
 * others: everything visible at once, and a timeline). The page had shown
 * both days in full, a card per item, so Day 2, the main conference, sat
 * thirteen phone screens down and a five-minute host bit weighed as much as
 * a panel. Now:
 *
 * - A day switcher shows one day (components/schedule/day-switch.tsx). Both
 *   are in the HTML.
 * - A day is one hairline card per part ("Morning", "Afternoon"), split at its
 *   long break, which sits between the cards (lib/run-of-show-layout.ts).
 * - Programme sessions show in full with their people. A run of supporting
 *   items (hosts, sponsors, entertainment, doors, closing) is one quiet row
 *   that opens to show each one with its time.
 * - Each fact is said once, where it is true: the venue and the hall once per
 *   day, "two rooms at the same time" once, Lagos time in the page's hero.
 * - The time is a narrow column at every width, never a block on top.
 */

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

// The row: a narrow time column, then the content. Flex, not grid: the time
// column is the point of the layout at every width, phones too.
const ROW = "flex gap-3 px-4 sm:gap-5 sm:px-5";

function Times({
  date,
  start,
  end,
  quiet = false,
}: {
  date: string;
  start: string;
  end: string;
  quiet?: boolean;
}) {
  // A span, not a <p>: the quiet rows put it inside a <summary>.
  return (
    <span className="block w-12 shrink-0 text-sm leading-5 tabular-nums sm:w-14">
      <time
        dateTime={`${date}T${start}`}
        className={`block ${quiet ? "text-gray-500" : "font-semibold text-gray-900"}`}
      >
        {start}
      </time>
      <span className="sr-only"> to </span>
      <time dateTime={`${date}T${end}`} className="block text-gray-500">
        {end}
      </time>
    </span>
  );
}

function People({ people, className = "mt-2" }: { people?: RunPeople[]; className?: string }) {
  if (!people?.length) return null;
  return (
    <dl className={`${className} space-y-0.5 text-sm leading-relaxed`}>
      {people.map((line) => (
        <div key={line.label}>
          <dt className="inline text-gray-500">{line.label}:</dt>{" "}
          <dd className="inline text-gray-800">
            <LinkedNames text={line.names} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A place on its own line, so it never wraps behind a separator. A span, so it may sit in a <summary>. */
function Place({ place, className = "mt-1" }: { place: string; className?: string }) {
  return (
    <span className={`${className} flex w-fit items-center gap-1 text-sm leading-5 text-gray-500`}>
      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {place}
    </span>
  );
}

function ProgrammeRow({ session, date, home }: { session: RunSession; date: string; home?: string }) {
  const kind = session.label ?? KIND_NAME[session.kind];
  const showKind = kind.toLowerCase() !== session.title.toLowerCase();
  return (
    <li className={`${ROW} py-4`}>
      <Times date={date} start={session.start} end={session.end} />
      <div className="min-w-0 flex-1">
        {showKind && <p className="text-[13px] font-semibold leading-5 text-brand-blue">{kind}</p>}
        <h3 className="text-base font-bold leading-snug text-gray-900 sm:text-lg sm:leading-snug">
          {session.title}
        </h3>
        {session.detail && <p className="mt-1 text-sm leading-relaxed text-gray-600">{session.detail}</p>}
        {session.place && session.place !== home && <Place place={session.place} />}
        <People people={session.people} />
      </div>
    </li>
  );
}

function SplitRow({ split, date }: { split: RunSplit; date: string }) {
  const tracks = split.tracks
    .map((track) => ({ track, room: roomOf(track.room) }))
    .sort((a, b) => roomNumber(a.room) - roomNumber(b.room));
  return (
    <li className={`${ROW} py-4`}>
      <Times date={date} start={split.start} end={split.end} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-5 text-brand-blue">{split.label}</p>
        <SplitTracks
          tracks={tracks.map(({ track, room }) => ({
            room: room.key,
            node: (
              <>
                <p className="text-[13px] font-medium leading-5 text-gray-500">
                  {room.number}
                  {room.name && ` · ${room.name}`}
                </p>
                <h3 className="text-base font-bold leading-snug text-gray-900 sm:text-lg sm:leading-snug">
                  {track.title}
                </h3>
                <People people={track.people} />
              </>
            ),
          }))}
        />
      </div>
    </li>
  );
}

/** What a supporting item has beyond its name and time. */
function Extra({
  session,
  home,
  placeSaid,
  showLabel,
}: {
  session: RunSession;
  home?: string;
  placeSaid: boolean;
  showLabel: boolean;
}) {
  return (
    <>
      {showLabel && session.label && <p className="text-[13px] leading-5 text-gray-500">{session.label}</p>}
      {session.detail && <p className="text-sm leading-relaxed text-gray-600">{session.detail}</p>}
      {!placeSaid && session.place && session.place !== home && <Place place={session.place} />}
      <People people={session.people} className="mt-1" />
    </>
  );
}

/**
 * A run of supporting items as one quiet row. It opens when there is more
 * to it than its name: several items, or a detail, a place or people.
 */
function QuietRow({ items, date, home }: { items: RunSession[]; date: string; home?: string }) {
  const first = items[0];
  const last = items[items.length - 1];
  const single = items.length === 1;
  const places = new Set(items.map((s) => s.place));
  const shared = places.size === 1 ? first.place : undefined;
  const place = shared && shared !== home ? shared : undefined;
  const more =
    !single ||
    Boolean(
      (first.label && quietName(first) === first.title) ||
        first.detail ||
        first.people?.length ||
        (first.place && first.place !== home && !place),
    );

  const name = <span className="text-gray-700">{items.map(quietName).join(" · ")}</span>;

  if (!more) {
    return (
      <li className={`${ROW} py-3`}>
        <Times date={date} start={first.start} end={last.end} quiet />
        <div className="min-w-0 flex-1 text-sm leading-5">
          {name}
          {place && <Place place={place} className="mt-0.5" />}
        </div>
      </li>
    );
  }

  return (
    <li>
      {/* Open is state, so it shows on a 2px left edge: an inset shadow,
          not a border, so nothing in the row moves when it opens. */}
      <details className="group/fold open:shadow-[inset_2px_0_0_var(--color-gray-300)]">
        <summary
          className={`${ROW} min-h-11 cursor-pointer list-none py-3 -outline-offset-2 transition-colors duration-150 hover:bg-paper-muted [&::-webkit-details-marker]:hidden`}
        >
          <Times date={date} start={first.start} end={last.end} quiet />
          <span className="min-w-0 flex-1 text-sm leading-5">
            {name}
            <ChevronDown
              className="ml-1 inline-block h-4 w-4 align-[-3px] text-gray-500 transition-transform duration-150 group-open/fold:rotate-180"
              aria-hidden="true"
            />
            {place && <Place place={place} className="mt-0.5" />}
          </span>
        </summary>
        {single ? (
          <div className={`${ROW} pb-3`}>
            <span className="w-12 shrink-0 sm:w-14" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <Extra
                session={first}
                home={home}
                placeSaid={Boolean(place)}
                showLabel={quietName(first) === first.title}
              />
            </div>
          </div>
        ) : (
          <ol className="pb-2">
            {items.map((s) => (
              <li key={`${s.start}-${s.title}`} className={`${ROW} py-1.5`}>
                <Times date={date} start={s.start} end={s.end} quiet />
                <div className="min-w-0 flex-1">
                  {s.label && quietName(s) === s.title && (
                    <p className="text-[13px] leading-5 text-gray-500">{s.label}</p>
                  )}
                  <p className="text-sm font-medium leading-5 text-gray-900">{quietName(s)}</p>
                  <Extra session={s} home={home} placeSaid={Boolean(place)} showLabel={false} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </details>
    </li>
  );
}

/** The long break between two parts of the day, between their cards. */
function Pause({ items, date, home }: { items: RunSession[]; date: string; home?: string }) {
  return (
    <div className="border-x border-transparent py-1">
      {items.map((s) => (
        <div key={`${s.start}-${s.title}`} className={`${ROW} py-3`}>
          <Times date={date} start={s.start} end={s.end} quiet />
          <div className="min-w-0 flex-1 text-sm leading-5">
            <p>
              {!labelSaid(s) && <span className="text-gray-500">{s.label}: </span>}
              <span className="font-semibold text-gray-900">{s.title}</span>
            </p>
            {s.place && s.place !== home && <Place place={s.place} className="mt-0.5" />}
            {s.detail && <p className="mt-1 text-gray-600">{s.detail}</p>}
            <People people={s.people} className="mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PartCard({
  part,
  date,
  home,
}: {
  part: Extract<Segment, { type: "part" }>;
  date: string;
  home?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-baseline justify-between gap-x-4 border-b border-gray-200 px-4 py-3 sm:px-5">
        <p className="text-base font-bold text-gray-900">{part.name}</p>
        <p className="text-sm tabular-nums text-gray-500">
          <time dateTime={`${date}T${part.start}`}>{part.start}</time> to{" "}
          <time dateTime={`${date}T${part.end}`}>{part.end}</time>
        </p>
      </div>
      <ol className="divide-y divide-gray-200">
        {part.rows.map((row) =>
          row.type === "split" ? (
            <SplitRow key={`${row.split.start}-split`} split={row.split} date={date} />
          ) : row.type === "programme" ? (
            <ProgrammeRow
              key={`${row.session.start}-${row.session.title}`}
              session={row.session}
              date={date}
              home={home}
            />
          ) : (
            <QuietRow key={`${row.items[0].start}-quiet`} items={row.items} date={date} home={home} />
          ),
        )}
      </ol>
    </div>
  );
}

function DayPanel({ day }: { day: RunDay }) {
  const home = homePlace(day);
  const splits = day.blocks.filter(isSplit);
  const opens = day.blocks[0]?.start;
  const closes = day.blocks[day.blocks.length - 1]?.end;

  const body = (
    <div className="mt-6">
      {segmentsOf(day).map((segment) =>
        segment.type === "part" ? (
          <PartCard key={`part-${segment.start}`} part={segment} date={day.date} home={home} />
        ) : (
          <Pause key={`pause-${segment.items[0].start}`} items={segment.items} date={day.date} home={home} />
        ),
      )}
    </div>
  );

  return (
    <div className="pt-6 sm:pt-8">
      {/* The tab says the date. Without JavaScript there are no tabs, so the
          <noscript> style shows this line instead. */}
      <p hidden data-schedule-nojs className="eyebrow mb-3 text-brand-blue">
        {day.name} · {dayName(day.date)}
      </p>
      <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{day.theme}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-base text-gray-600">
        <p className="inline-flex items-center gap-1.5">
          <MapPin className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
          {day.venue}, Lagos
        </p>
        {opens && closes && (
          <p className="inline-flex items-center gap-1.5 tabular-nums">
            <Clock className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
            <time dateTime={`${day.date}T${opens}`}>{opens}</time> to{" "}
            <time dateTime={`${day.date}T${closes}`}>{closes}</time>
          </p>
        )}
      </div>
      {home && <p className="mt-1 text-base text-gray-600">All sessions in the {home} unless noted.</p>}
      {splits.length > 0 ? (
        <RoomScope rooms={roomsOf(splits)} from={splits[0].start}>
          {body}
        </RoomScope>
      ) : (
        body
      )}
    </div>
  );
}

/*
 * Without JavaScript there is nothing to switch with: both days show, each
 * with its date line, and the controls go. The panels' `hidden` is overridden
 * from the theme layer because Tailwind's preflight hides [hidden] with
 * !important in the base layer, and for !important rules an earlier layer
 * beats a later one (and any layer beats unlayered CSS), so a rule anywhere
 * else would lose. Exported so a test can hold the markup to it.
 */
export const NO_SCRIPT = `<style>[data-schedule-js]{display:none!important}@layer theme{[data-schedule-panel][hidden],[data-schedule-nojs][hidden]{display:block!important}}</style>`;

/** The 2026 run of show: the day switcher, then the chosen day, part by part. */
export function RunOfShow() {
  const days: DayTab[] = runOfShow2026.map((day) => ({
    id: day.id,
    name: day.name,
    date: day.date,
    short: shortDay(day.date),
    long: dayName(day.date),
    theme: day.theme,
  }));

  return (
    <div className="max-w-4xl">
      <noscript dangerouslySetInnerHTML={{ __html: NO_SCRIPT }} />
      <DaySwitch
        days={days}
        panels={runOfShow2026.map((day) => (
          <DayPanel key={day.id} day={day} />
        ))}
      />
    </div>
  );
}
