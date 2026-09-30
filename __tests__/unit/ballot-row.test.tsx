import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BallotRows } from "@/components/campaigns/ballot-rows";
import { Ballot } from "@/components/campaigns/ballot";
import { formatTimeLeft } from "@/lib/countdown";

/*
 * One nominee on the ballot.
 *
 * Owner feedback on the cards this replaces: "This is ugly." Four mostly
 * empty boxes, "Week 1" on each, a wall of underlined links and a Vote pill
 * as wide as the card. These pin the row that replaced them: the entry as
 * named platform marks, one compact Vote, the form opening in place with a
 * way back, the server's answers shown word for word (they are uniform on
 * purpose), and the page saying each fact once.
 */

const SERVER =
  "If this address has not confirmed a vote in this round yet, a six digit code is on its way to its inbox. If it has, no new code will come and there is nothing more to do: a confirmed vote cannot be changed.";

type Answer = { ok: boolean; message?: string; nomineeId?: string };
let answers: Answer[] = [];
const fetchMock = vi.fn(async () => {
  const answer = answers.shift() ?? { ok: true, message: SERVER };
  return { ok: answer.ok, json: async () => answer };
});

beforeEach(() => {
  answers = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const ENTRY = (name: string, nomineeId: string) => ({
  name,
  nomineeId,
  roundId: "r",
  links: [
    { platform: "x", url: `https://x.com/${nomineeId}/status/1` },
    { platform: "tiktok", url: `https://tiktok.com/@${nomineeId}/video/2` },
  ],
});

const ballot = (votingOpen = true) =>
  render(
    <BallotRows
      entries={[ENTRY("Ada Obi", "a"), ENTRY("Ben Eze", "b")]}
      votingOpen={votingOpen}
    />,
  );

const vote = (name = "Ada Obi") =>
  fireEvent.click(screen.getByRole("button", { name: `Vote for ${name}` }));

async function sendCode(name = "Ada Obi") {
  vote(name);
  fireEvent.change(screen.getByLabelText("Your email address"), {
    target: { value: "ada@example.com" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
  });
}

async function confirm(answer: Answer) {
  answers.push(answer);
  fireEvent.change(screen.getByLabelText("Six digit code"), { target: { value: "123456" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Confirm my vote" }));
  });
}

describe("BallotRow", () => {
  it("names each platform link for who and where, and opens it in a new tab", () => {
    ballot();
    const x = screen.getByRole("link", { name: "Ada Obi on X (opens in a new tab)" });
    expect(x.getAttribute("href")).toBe("https://x.com/a/status/1");
    expect(x.getAttribute("target")).toBe("_blank");
    expect(x.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    expect(screen.getByRole("link", { name: "Ada Obi on TikTok (opens in a new tab)" })).toBeTruthy();
    // No underlined text links left on the row.
    expect(screen.queryByText("X")).toBeNull();
  });

  it("lists the marks X, Instagram, TikTok, whatever order the links arrive in", () => {
    // Phones have no platform cells, so the order is the only thing that
    // lines the ballot up with the weekly winners above it.
    render(
      <BallotRows
        entries={[
          {
            ...ENTRY("Ada Obi", "a"),
            links: [
              { platform: "tiktok", url: "https://tiktok.com/@a/video/2" },
              { platform: "instagram", url: "https://instagram.com/p/a/" },
              { platform: "x", url: "https://x.com/a/status/1" },
            ],
          },
        ]}
        votingOpen
      />,
    );
    const entry = screen.getByRole("list", { name: "Ada Obi's entry" });
    expect(
      Array.from(entry.querySelectorAll("a")).map((a) => a.getAttribute("aria-label")),
    ).toEqual([
      "Ada Obi on X (opens in a new tab)",
      "Ada Obi on Instagram (opens in a new tab)",
      "Ada Obi on TikTok (opens in a new tab)",
    ]);
  });

  it("lists the nominees without a button before the open and after the close", () => {
    ballot(false);
    expect(screen.getByText("Ada Obi")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens the form in place, says the rule that matters at that moment, and moves focus to it", () => {
    ballot();
    vote();
    const input = screen.getByLabelText("Your email address");
    expect(document.activeElement).toBe(input);
    expect(document.body.textContent).toContain("A confirmed vote cannot be changed.");
    expect(screen.queryByRole("button", { name: "Vote for Ada Obi" })).toBeNull();
  });

  it("has a way back that does not send anything", () => {
    ballot();
    vote();
    fireEvent.click(screen.getByRole("button", { name: "Cancel voting for Ada Obi" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Vote for Ada Obi" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps one form open: opening another row closes the first, without moving focus back", () => {
    ballot();
    vote("Ada Obi");
    vote("Ben Eze");
    expect(screen.getAllByLabelText("Your email address")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Vote for Ada Obi" })).toBeTruthy();
    expect(document.activeElement?.id).toBe("vote-email-b");
  });

  it("shows the server's answer to a cast word for word, as the code field's description", async () => {
    ballot();
    await sendCode();
    expect(screen.getByText(SERVER)).toBeTruthy();
    const input = screen.getByLabelText("Six digit code");
    expect(document.activeElement).toBe(input);
    // Focus lands past the notice, so the field must carry it.
    const described = document.getElementById(input.getAttribute("aria-describedby") ?? "");
    expect(described?.textContent).toBe(SERVER);
  });

  it("shows a refusal as the server words it", async () => {
    answers.push({ ok: false, message: "That is a lot of codes for one address." });
    ballot();
    await sendCode();
    expect(screen.getByRole("alert").textContent).toBe("That is a lot of codes for one address.");
    expect(screen.getByLabelText("Your email address")).toBeTruthy();
  });

  it("marks the nominee the server confirmed, announces the server's words, and hands focus to it", async () => {
    ballot();
    await sendCode();
    await confirm({ ok: true, message: "Your vote is in.", nomineeId: "a" });
    const voted = screen.getByText("Voted");
    expect(voted.closest("li")?.textContent).toContain("Ada Obi");
    expect(document.activeElement).toBe(voted);
    expect(screen.getByText("Your vote is in.").getAttribute("aria-live")).toBe("polite");
    expect(screen.queryByRole("button", { name: "Vote for Ada Obi" })).toBeNull();
  });

  it("marks the row the server names, not the row the code was typed into", async () => {
    // A pending vote moved to Ben by a later cast; its code typed into
    // Ada's form confirms Ben, and the page must say so.
    ballot();
    await sendCode("Ada Obi");
    await confirm({ ok: true, message: "Your vote is in.", nomineeId: "b" });
    expect(screen.getByText("Voted").closest("li")?.textContent).toContain("Ben Eze");
    expect(screen.getByRole("button", { name: "Vote for Ada Obi" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Your vote for/);
  });
});

describe("the ballot header", () => {
  const entries = (opensAt: string, closesAt: string) => [
    { ...ENTRY("Ada Obi", "a"), weekNo: 1, opensAt, closesAt },
  ];

  it("gives both ends of the window before voting opens", () => {
    render(<Ballot entries={entries("2026-10-04T07:00:00.000Z", "2026-10-06T07:00:00.000Z")} state="before" />);
    expect(document.body.textContent).toMatch(/Voting opens .*4 October.* and closes .*6 October.*, Lagos time\./);
  });

  it("says closed only when it is, and nothing it cannot know when the close is unreadable", () => {
    const { unmount } = render(<Ballot entries={entries("", "2026-09-20T07:00:00.000Z")} state="closed" />);
    // The week is said by the card around the ballot now, not by the ballot.
    expect(document.body.textContent).toContain("Voting has closed.");
    unmount();
    render(<Ballot entries={entries("", "")} state="none" />);
    expect(document.body.textContent).not.toContain("has closed");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the clock", () => {
  it("does not say Closed in the last minute, while votes are still taken", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T06:59:30Z"));
    expect(formatTimeLeft("2026-09-29T07:00:00Z")).toBe("Under a minute left");
    vi.setSystemTime(new Date("2026-09-29T07:00:01Z"));
    expect(formatTimeLeft("2026-09-29T07:00:00Z")).toBe("Closed");
    vi.useRealTimers();
  });
});

describe("the winners page ballot", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
  // The ballot is drawn inside its week's card now (weekly-winners.tsx), so
  // "the page" here is the page and the week card together.
  const page =
    read("app/campaigns/monica-money-story/winners/page.tsx") +
    read("components/campaigns/weekly-winners.tsx");
  const ballotSrc = read("components/campaigns/ballot.tsx");

  it("is one ballot with the clock in its header, not a card per nominee", () => {
    expect(page).toContain("<Ballot entries={shortlist} state={ballotState} />");
    expect(ballotSrc).toContain("<BallotRows");
    expect(read("components/campaigns/ballot-rows.tsx")).toContain('<ul className="divide-y divide-line">');
    expect(ballotSrc).toContain("<TimeLeftLabel");
    expect(page).not.toContain("VotePanel");
    expect(page).not.toMatch(/grid gap-4 sm:grid-cols-2/);
  });

  it("does not print the week on every nominee", () => {
    expect(page + ballotSrc).not.toMatch(/Week \{entry\.weekNo\}/);
  });
});
