"use client";

import { useState } from "react";
import { BallotRow } from "@/components/campaigns/ballot-row";

/**
 * The ballot's rows, and the two facts that belong to the ballot rather than
 * to any one row.
 *
 * One form open at a time. The engine holds one pending vote per address,
 * and a second cast moves it to the new nominee with a new code; the code
 * does not name a nominee. With a form open on two rows, the code from the
 * later cast could be typed into the earlier row's form and that row would
 * have claimed a vote the server had given to someone else. Opening a row
 * now closes any other.
 *
 * Which nominee the confirmed vote went to, as the server named it, so the
 * right row says Voted. And one polite announcement for the whole ballot,
 * in the server's own words, rather than a live region per row.
 */
export function BallotRows({
  entries,
  votingOpen,
}: {
  entries: {
    name: string;
    links: { platform: string; url: string }[];
    roundId: string;
    nomineeId: string;
  }[];
  votingOpen: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [votedId, setVotedId] = useState<string | null>(null);
  const [said, setSaid] = useState("");

  return (
    <>
      <ul className="divide-y divide-line">
        {entries.map((entry, index) => (
          <BallotRow
            key={entry.nomineeId || `${entry.name}-${index}`}
            roundId={entry.roundId}
            nomineeId={entry.nomineeId}
            name={entry.name}
            links={entry.links}
            votingOpen={votingOpen}
            active={openId === entry.nomineeId}
            voted={votedId === entry.nomineeId}
            onOpen={() => setOpenId(entry.nomineeId)}
            onClose={() => setOpenId((id) => (id === entry.nomineeId ? null : id))}
            onVoted={(confirmed, message) => {
              setOpenId(null);
              setVotedId(confirmed);
              setSaid(message);
            }}
          />
        ))}
      </ul>
      {/* Always present, so the confirmation is announced when it lands. */}
      <p aria-live="polite" className="sr-only">
        {said}
      </p>
    </>
  );
}
