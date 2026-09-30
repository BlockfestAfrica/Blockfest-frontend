/**
 * The Creator of the Week picker says who is missing, by name.
 *
 * It used to say "1 creator is missing from this list because they have
 * already been Creator of the Week", a number worked out by subtracting the
 * candidate list from a separate leaderboard read. The two reads were not one
 * snapshot, so an approval landing between them produced the sentence when
 * nobody had won, and the leaderboard read was capped at 500 while the
 * candidate list was not. The names now come from the announced picks, which
 * are exactly the set the candidate list filters on.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WinnersPanel, type PickedRow } from "@/components/admin/winners-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const CANDIDATE = {
  enrolmentId: "33333333-3333-3333-3333-333333333333",
  name: "Chidi Eze",
  points: 250,
  rank: 1,
};

const row = (over: Partial<PickedRow>): PickedRow => ({
  weekNo: 1,
  category: "creator_of_week",
  enrolmentId: "11111111-1111-1111-1111-111111111111",
  name: "Amara Obi",
  prizeNaira: 300_000,
  note: null,
  publishedAt: "2026-09-20T18:00:00.000Z",
  ...over,
});

const panel = (picked: PickedRow[], weekNo = 3) =>
  render(
    <WinnersPanel
      weekNo={weekNo}
      creatorCandidates={[CANDIDATE]}
      favouriteCandidates={[CANDIDATE]}
      frozen
      vote={null}
      picked={picked}
    />,
  );

describe("who the no-repeat rule keeps out of the picker", () => {
  it("names a single past winner and the week they won", () => {
    panel([row({})]);
    expect(
      screen.getByText(
        "Amara Obi is not in this list: Creator of the Week in week 1, and nobody wins it twice. Community Favourite has no such rule.",
      ),
    ).toBeTruthy();
  });

  it("lists several in week order", () => {
    panel([
      row({ weekNo: 2, name: "Bisi Ade", enrolmentId: "22222222-2222-2222-2222-222222222222" }),
      row({ weekNo: 1 }),
    ]);
    expect(
      screen.getByText(
        /Not in this list, because nobody wins it twice: Amara Obi \(week 1\), Bisi Ade \(week 2\)\./,
      ),
    ).toBeTruthy();
  });

  it("does not count a draft, which is not a win", () => {
    panel([row({ publishedAt: null })]);
    expect(screen.queryByText(/not in this list/i)).toBeNull();
  });

  it("does not count a Community Favourite, which may repeat", () => {
    panel([row({ category: "community_favourite" })]);
    expect(screen.queryByText(/not in this list/i)).toBeNull();
  });

  it("says nothing on the Community Favourite tab", () => {
    panel([row({})]);
    fireEvent.click(screen.getByRole("button", { name: "Community Favourite" }));
    expect(screen.queryByText(/not in this list/i)).toBeNull();
  });

  it("says an old draft of someone who has since won cannot be announced, and offers no Load", () => {
    panel(
      [
        row({ weekNo: 1, publishedAt: null }),
        row({ weekNo: 2, name: "Amara Obi" }),
      ],
      1,
    );
    expect(
      screen.getByText(
        /Not public, and it cannot be: Amara Obi was announced as Creator of the Week in week 2, and nobody wins it twice\./,
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /load the draft/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /discard this draft/i }),
    ).toBeTruthy();
  });

  it("still offers Load for an ordinary draft", () => {
    panel([row({ weekNo: 1, publishedAt: null })], 1);
    expect(screen.getByText(/Load it below to announce it/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /load the draft/i })).toBeTruthy();
  });

  it("no longer derives it from a second leaderboard read", () => {
    const page = readFileSync(
      join(process.cwd(), "app/admin/(console)/winners/page.tsx"),
      "utf8",
    );
    expect(page).not.toMatch(/leaderboard\(500\)/);
    expect(page).not.toMatch(/excludedCount/);
  });
});
