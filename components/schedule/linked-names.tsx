import Link from "next/link";
import { is2026Speaker, SpeakersList, speakerSlug } from "@/lib/speakers";

/** Sheet names that are the same person as a 2026 speaker profile. */
const NAME_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["Dr. Maruf Olatunji Alausa", "Dr. Tunji Alausa"],
  ["Xploit", "Achebo Edwin (Xploit)"],
  ["Ayomide Shodipo", "Shodipo Ayomide"],
  ["Achusi Amara", "Amara Achusi"],
  ["Crypto Oracle", "Abdulsamad Tiamiyu (Crypto Oracle)"],
  ["Salem King", "Salemking"],
  ["Bolutife Kusimo", "Dr. Bolutife Kusimo"],
  ["Ashley Olika", "Ashley Rene Olika"],
  ["Timilehin Kayode", "Kayode Oluwatimilehin"],
  ["Scott Eneje", "Scott C. Eneje"],
  ["Dara Sobaloju", "Dára Sobaloju"],
  ["Nifemi Dave", "Oluwanifemi David Babanumi"],
  ["Teddi", "Teddi Speaks"],
];

const PROFILES = SpeakersList.filter(is2026Speaker)
  .flatMap((s) => {
    const href = `/speakers/${speakerSlug(s.name)}`;
    const aliases = NAME_ALIASES.filter(([, canonical]) => canonical === s.name).map(([sheet]) => sheet);
    return [s.name, ...aliases].map((name) => ({ name, href }));
  })
  .sort((a, b) => b.name.length - a.name.length);

/** Turn a names line into text with profile links for anyone on the 2026 lineup. */
export function LinkedNames({ text }: { text: string }) {
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
