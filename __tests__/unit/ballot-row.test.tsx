import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BallotRow } from "@/components/campaigns/ballot-row";

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

let answer: { ok: boolean; message?: string } = { ok: true, message: SERVER };
const fetchMock = vi.fn(async () => ({ ok: answer.ok, json: async () => answer }));

beforeEach(() => {
  answer = { ok: true, message: SERVER };
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const LINKS = [
  { platform: "x", url: "https://x.com/ada/status/1" },
  { platform: "tiktok", url: "https://tiktok.com/@ada/video/2" },
];

const row = (votingOpen = true) =>
  render(
    <ul>
      <BallotRow roundId="r" nomineeId="n" name="Ada Obi" links={LINKS} votingOpen={votingOpen} />
    </ul>,
  );

const vote = () => fireEvent.click(screen.getByRole("button", { name: "Vote for Ada Obi" }));

async function sendCode() {
  vote();
  fireEvent.change(screen.getByLabelText("Your email address"), {
    target: { value: "ada@example.com" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
  });
}

describe("BallotRow", () => {
  it("names each platform link for who and where, and opens it in a new tab", () => {
    row();
    const x = screen.getByRole("link", { name: "Ada Obi on X (opens in a new tab)" });
    expect(x.getAttribute("href")).toBe("https://x.com/ada/status/1");
    expect(x.getAttribute("target")).toBe("_blank");
    expect(x.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    expect(screen.getByRole("link", { name: "Ada Obi on TikTok (opens in a new tab)" })).toBeTruthy();
    // No underlined text links left on the row.
    expect(screen.queryByText("X")).toBeNull();
  });

  it("lists the nominee without a button before the open and after the close", () => {
    row(false);
    expect(screen.getByText("Ada Obi")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens the form in place, says the rule that matters at that moment, and moves focus to it", () => {
    row();
    vote();
    const input = screen.getByLabelText("Your email address");
    expect(document.activeElement).toBe(input);
    expect(document.body.textContent).toContain("A confirmed vote cannot be changed.");
    expect(screen.queryByRole("button", { name: "Vote for Ada Obi" })).toBeNull();
  });

  it("has a way back that does not send anything", () => {
    row();
    vote();
    fireEvent.click(screen.getByRole("button", { name: "Cancel voting for Ada Obi" }));
    const back = screen.getByRole("button", { name: "Vote for Ada Obi" });
    expect(document.activeElement).toBe(back);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's answer to a cast word for word, and moves to the code", async () => {
    row();
    await sendCode();
    expect(screen.getByText(SERVER)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Six digit code"));
  });

  it("shows a refusal as the server words it", async () => {
    answer = { ok: false, message: "That is a lot of codes for one address." };
    row();
    await sendCode();
    expect(screen.getByRole("alert").textContent).toBe("That is a lot of codes for one address.");
    expect(screen.getByLabelText("Your email address")).toBeTruthy();
  });

  it("marks the row voted once the code is confirmed, and says so to a screen reader", async () => {
    row();
    await sendCode();
    answer = { ok: true, message: "Your vote is in." };
    fireEvent.change(screen.getByLabelText("Six digit code"), { target: { value: "123456" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm my vote" }));
    });
    expect(screen.getByText("Voted")).toBeTruthy();
    expect(document.body.textContent).toContain("Your vote for Ada Obi is in.");
    expect(screen.queryByRole("button", { name: "Vote for Ada Obi" })).toBeNull();
  });
});

describe("the winners page ballot", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
  const page = read("app/campaigns/monica-money-story/winners/page.tsx");
  const ballot = read("components/campaigns/ballot.tsx");

  it("is one ballot with the clock in its header, not a card per nominee", () => {
    expect(page).toContain("<Ballot entries={shortlist} state={voteState} />");
    expect(ballot).toContain("<BallotRow");
    expect(ballot).toContain('<ul className="divide-y divide-line">');
    expect(ballot).toContain("<TimeLeftLabel");
    expect(page).not.toContain("VotePanel");
    expect(page).not.toMatch(/grid gap-4 sm:grid-cols-2/);
  });

  it("does not print the week on every nominee", () => {
    expect(page + ballot).not.toMatch(/Week \{entry\.weekNo\}/);
  });
});
