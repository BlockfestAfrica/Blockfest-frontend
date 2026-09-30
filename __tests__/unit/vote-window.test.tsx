import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { VoteRoundPanel } from "@/components/admin/vote-round-panel";
import { WinnersPanel } from "@/components/admin/winners-panel";

/*
 * A vote that runs past midnight.
 *
 * Admin feedback: the form had one "voting day" with an open and a close time
 * on it, so a vote could only ever run within one day, and the plan is 48
 * hours. These drive the real form: a date and a time on each side, a 48-hour
 * default, the length said back, a close before the open refused before the
 * round trip, and both dates in what is sent and in the question before it.
 */

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: nav.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
/** Saturday 26 September, 11:00 Lagos: the Sunday vote is still ahead. */
const SATURDAY = new Date("2026-09-26T10:00:00Z");
beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(SATURDAY);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const CANDIDATES = [
  { entryId: "e1", name: "Ada Obi", points: 300, approvedPlatforms: 2 },
  { entryId: "e2", name: "Ben Eze", points: 250, approvedPlatforms: 1 },
  { entryId: "e3", name: "Cy Ade", points: 200, approvedPlatforms: 1 },
];

function renderForm(frozen = true) {
  render(<VoteRoundPanel weekNo={1} round={null} candidates={CANDIDATES} tally={null} frozen={frozen} />);
  // Each label carries the points too, so match the name within it.
  for (const c of CANDIDATES) fireEvent.click(screen.getByLabelText(new RegExp(c.name)));
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement;
const set = (id: string, value: string) => fireEvent.change(field(id), { target: { value } });
const openButton = () => screen.getByRole("button", { name: "Open the vote" });

describe("the vote window", () => {
  it("has a date and a time for the open and for the close, 48 hours apart by default", () => {
    renderForm();
    for (const id of ["opens-day", "opens-time", "closes-day", "closes-time"]) {
      expect(field(id), id).toBeTruthy();
    }
    expect(field("opens-day").type).toBe("date");
    expect(field("closes-day").type).toBe("date");
    expect(screen.getByText("48 hours")).toBeTruthy();
    expect(
      screen.getByText("Sunday 27 September 08:00 to Tuesday 29 September 08:00. All times Lagos."),
    ).toBeTruthy();
  });

  it("says the length back as the dates change", () => {
    renderForm();
    set("opens-day", "2026-09-27");
    set("opens-time", "08:00");
    set("closes-day", "2026-09-28");
    set("closes-time", "18:00");
    expect(screen.getByText("34 hours")).toBeTruthy();
    expect(
      screen.getByText("Sunday 27 September 08:00 to Monday 28 September 18:00. All times Lagos."),
    ).toBeTruthy();
  });

  it("refuses a close at or before the open, before anything is sent", () => {
    renderForm();
    set("opens-day", "2026-09-27");
    set("opens-time", "08:00");
    set("closes-day", "2026-09-27");
    set("closes-time", "08:00");
    expect(screen.getByText("The vote has to close after it opens.")).toBeTruthy();
    expect(openButton()).toHaveProperty("disabled", true);

    set("closes-day", "2026-09-26");
    set("closes-time", "20:00");
    expect(openButton()).toHaveProperty("disabled", true);
  });

  it("asks with both dates and the length, and sends both dates", async () => {
    renderForm();
    set("opens-day", "2026-09-27");
    set("opens-time", "08:00");
    set("closes-day", "2026-09-29");
    set("closes-time", "08:00");
    fireEvent.click(openButton());
    const question = screen.getByRole("alertdialog").textContent ?? "";
    expect(question).toContain(
      "from Sunday 27 September 08:00 to Tuesday 29 September 08:00 Lagos time (48 hours)?",
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, open the vote" }));
    });
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      action: "open",
      opensAt: "2026-09-27T08:00:00+01:00",
      closesAt: "2026-09-29T08:00:00+01:00",
    });
  });
});

describe("safeguards", () => {
  it("will not open a vote that runs into the next stage until the week is recorded", () => {
    renderForm(false);
    set("opens-day", "2026-09-27");
    set("closes-day", "2026-09-29");
    expect(screen.getByText(/Record the week 1 standings first\. This vote closes after stage 2 starts/)).toBeTruthy();
    expect(openButton()).toHaveProperty("disabled", true);
    // Inside the week, the freeze is not needed to open.
    set("closes-day", "2026-09-27");
    set("closes-time", "20:00");
    expect(openButton()).toHaveProperty("disabled", false);
  });

  it("counts the length from now when the open time has already passed", () => {
    vi.setSystemTime(new Date("2026-09-27T18:00:00Z")); // Sunday 19:00 Lagos
    renderForm();
    set("opens-day", "2026-09-27");
    set("opens-time", "08:00");
    set("closes-day", "2026-09-29");
    set("closes-time", "08:00");
    expect(screen.getByText("About 37 hours")).toBeTruthy();
    expect(
      screen.getByText(
        "The open time has passed, so it opens as soon as you confirm and closes Tuesday 29 September 08:00. All times Lagos.",
      ),
    ).toBeTruthy();
    fireEvent.click(openButton());
    expect(screen.getByRole("alertdialog").textContent).toContain(
      "from now to Tuesday 29 September 08:00 Lagos time (about 37 hours)?",
    );
  });

  it("refuses a close that has already passed, and says one minute properly", () => {
    renderForm();
    set("opens-day", "2026-09-25");
    set("closes-day", "2026-09-25");
    expect(screen.getByText("The close time has already passed.")).toBeTruthy();
    set("opens-day", "2026-09-27");
    set("opens-time", "08:00");
    set("closes-day", "2026-09-27");
    set("closes-time", "08:01");
    expect(screen.getByText("1 minute")).toBeTruthy();
  });

  it("offers no vote to open for a week that is over", () => {
    render(<VoteRoundPanel weekNo={1} round={null} candidates={CANDIDATES} tally={null} frozen isPast />);
    expect(screen.queryByRole("button", { name: "Open the vote" })).toBeNull();
    expect(screen.getByText(/Week 1.s vote was never opened, and the week is over/)).toBeTruthy();
  });

  it("stops offering to tell the creators once voting has closed", () => {
    const round = (closesAt: string) => ({
      roundId: "r1",
      status: "open" as const,
      opensAt: "2026-09-26T07:00:00Z",
      closesAt,
      reviewedAt: null,
    });
    const { unmount } = render(
      <VoteRoundPanel weekNo={1} round={round("2026-09-26T09:00:00Z")} candidates={CANDIDATES} tally={null} frozen />,
    );
    expect(screen.queryByRole("button", { name: "Tell the creators" })).toBeNull();
    unmount();
    render(<VoteRoundPanel weekNo={1} round={round("2026-09-29T07:00:00Z")} candidates={CANDIDATES} tally={null} frozen />);
    expect(screen.getByRole("button", { name: "Tell the creators" })).toBeTruthy();
    // The route refuses it too, for a page left open past the close.
    const route = readFileSync(join(process.cwd(), "app/api/admin/announce-vote/route.ts"), "utf8");
    expect(route).toMatch(/closes_at\)\.getTime\(\) <= Date\.now\(\)/);
  });
});

describe("removing a farm", () => {
  /*
   * A catch-all domain arrived as eleven random addresses in fourteen
   * minutes. Removing it was eleven dialogs; now one judgement removes the
   * votes on screen and blocks the domain, with one reason, through the same
   * confirm step.
   */
  const members = Array.from({ length: 11 }, (_, i) => ({
    voteId: `v${i}`,
    email: `abc${i}@oemails.com`,
    createdAt: "2026-09-27T19:13:00Z",
    held: i === 10,
  }));
  const tally = {
    nominees: [{ nomineeId: "n1", name: "Ada Obi", votes: 10 }],
    domains: [{ domain: "oemails.com", votes: 11, members, blockable: true }],
    ips: [],
    held: [],
    unverified: 0,
  };
  const round = {
    roundId: "r1",
    status: "open" as const,
    opensAt: "2026-09-26T07:00:00Z",
    closesAt: "2026-09-29T07:00:00Z",
    reviewedAt: null,
  };

  it("removes the votes on screen as fraud and blocks the domain, with one reason, after a confirm", async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      // Fewer than the eleven shown: another owner got to one first. The
      // toast says what the server did, not what was asked.
      json: async () => ({ ok: true, domain: "oemails.com", removed: 9 }),
    }));
    render(<VoteRoundPanel weekNo={1} round={round} candidates={CANDIDATES} tally={tally} frozen />);
    fireEvent.click(screen.getByRole("button", { name: /oemails\.com/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove all 11 as fraud…" }));
    fireEvent.change(screen.getByLabelText("Why they go"), {
      target: { value: "Catch-all domain, random addresses" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove all 11" }));
    expect(document.body.textContent).toContain("Remove all 11 votes from oemails.com as fraud?");
    expect(document.body.textContent).toContain(
      "They stop counting, each address is barred from this round, and oemails.com is blocked for the rest of the campaign: new votes from it are turned away with a neutral message. Removal cannot be undone; the block can.",
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, remove and block" }));
    });
    const [, init] = fetchMock.mock.calls.at(-1) as unknown as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({
      action: "remove_domain",
      roundId: "r1",
      domain: "oemails.com",
      reason: "Catch-all domain, random addresses",
      voteIds: members.map((m) => m.voteId),
    });
    expect(toast.success).toHaveBeenLastCalledWith("Removed 9 as fraud and blocked oemails.com.");
  });

  it("names the hosts when a farm spread itself over subdomains", () => {
    // The cap and Remove all key on the registrable domain (0069), so the
    // row is one domain; the reviewer still sees where the votes came from.
    const spread = {
      ...tally,
      domains: [
        {
          domain: "oemails.com",
          votes: 11,
          members,
          hosts: [
            { host: "oemails.com", votes: 6 },
            { host: "a.oemails.com", votes: 5 },
          ],
        },
      ],
    };
    const { unmount } = render(
      <VoteRoundPanel weekNo={1} round={round} candidates={CANDIDATES} tally={spread} frozen />,
    );
    fireEvent.click(screen.getByRole("button", { name: /oemails\.com/ }));
    expect(document.body.textContent).toContain(
      "Subdomains count as one domain: oemails.com 6 · a.oemails.com 5",
    );
    unmount();

    // One host, the domain itself: nothing to explain.
    const plain = {
      ...tally,
      domains: [{ domain: "oemails.com", votes: 11, members, hosts: [{ host: "oemails.com", votes: 11 }] }],
    };
    render(<VoteRoundPanel weekNo={1} round={round} candidates={CANDIDATES} tally={plain} frozen />);
    fireEvent.click(screen.getByRole("button", { name: /oemails\.com/ }));
    expect(document.body.textContent).not.toContain("Subdomains count as one domain");
  });

  it("asks for the reason before it offers to remove anything", () => {
    render(<VoteRoundPanel weekNo={1} round={round} candidates={CANDIDATES} tally={tally} frozen />);
    fireEvent.click(screen.getByRole("button", { name: /oemails\.com/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove all 11 as fraud…" }));
    expect(screen.queryByRole("button", { name: "Remove all 11" })).toBeNull();
    expect(screen.getByText("Give the reason first.")).toBeTruthy();
  });

  it("warns before removing a school or government domain", () => {
    const campus = {
      ...tally,
      domains: [{ domain: "unilag.edu.ng", votes: 11, members, blockable: true, protectedDomain: true }],
    };
    render(<VoteRoundPanel weekNo={1} round={round} candidates={CANDIDATES} tally={campus} frozen />);
    fireEvent.click(screen.getByRole("button", { name: /unilag\.edu\.ng/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove all 11 as fraud…" }));
    fireEvent.change(screen.getByLabelText("Why they go"), { target: { value: "Farm" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove all 11" }));
    expect(document.body.textContent).toContain(
      "unilag.edu.ng looks like a school or government domain. Real students and staff will be turned away.",
    );
  });
});

describe("blocking a domain from its cluster", () => {
  const member = (i: number, held = false) => ({
    voteId: `b${i}`,
    email: `v${i}@farm.test`,
    createdAt: "2026-09-27T19:13:00Z",
    held,
  });
  const round = {
    roundId: "r1",
    status: "open" as const,
    opensAt: "2026-09-26T07:00:00Z",
    closesAt: "2026-09-29T07:00:00Z",
    reviewedAt: null,
  };
  type Domain = NonNullable<Parameters<typeof VoteRoundPanel>[0]["tally"]>["domains"][number];
  const panel = (domains: Domain[], held: NonNullable<Parameters<typeof VoteRoundPanel>[0]["tally"]>["held"] = []) => (
    <VoteRoundPanel
      weekNo={1}
      round={round}
      candidates={CANDIDATES}
      frozen
      tally={{ nominees: [], domains, ips: [], held, unverified: 0 }}
    />
  );

  it("offers Block on a small cluster and keeps Remove all for three or more", () => {
    const { unmount } = render(
      panel([{ domain: "farm.test", votes: 2, members: [member(1), member(2)], blockable: true }]),
    );
    fireEvent.click(screen.getByRole("button", { name: /farm\.test/ }));
    expect(screen.getByRole("button", { name: "Block…" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Remove all/ })).toBeNull();
    unmount();

    render(
      panel([
        { domain: "farm.test", votes: 3, members: [member(1), member(2), member(3)], blockable: true },
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: /farm\.test/ }));
    expect(screen.getByRole("button", { name: "Block…" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove all 3 as fraud…" })).toBeTruthy();
  });

  it("offers neither on a provider no block may touch", () => {
    render(
      panel([
        { domain: "ymail.com", votes: 4, members: [member(1), member(2), member(3), member(4)], blockable: false },
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: /ymail\.com/ }));
    expect(screen.queryByRole("button", { name: "Block…" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove all/ })).toBeNull();
    expect(document.body.textContent).toContain("ymail.com is shared by real voters, so it cannot be blocked.");
  });

  it("says on the row who blocked it, and does not offer Block again", () => {
    render(
      panel([
        { domain: "farm.test", votes: 3, members: [member(1), member(2), member(3)], blockable: true, block: "admin" },
        { domain: "other.test", votes: 3, members: [member(4), member(5), member(6)], blockable: true, block: "auto" },
      ]),
    );
    expect(screen.getByText("Blocked")).toBeTruthy();
    expect(screen.getByText("Blocked automatically")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /farm\.test/ }));
    expect(screen.queryByRole("button", { name: "Block…" })).toBeNull();
  });

  it("tags a domain whose mail goes to a forwarding service, and no other", () => {
    render(
      panel([
        { domain: "oemails.com", votes: 3, members: [member(1)], blockable: true, mxKind: "forwarder" },
        { domain: "acme.ng", votes: 3, members: [member(2)], blockable: true, mxKind: "major" },
        { domain: "plain.test", votes: 3, members: [member(3)], blockable: true, mxKind: null },
      ]),
    );
    expect(screen.getAllByText("Forwarding service")).toHaveLength(1);
    // On the row itself, beside the domain it describes.
    expect(screen.getByRole("button", { name: /oemails\.com.*Forwarding service/ })).toBeTruthy();
  });

  it("says how many of a cluster's addresses look machine-made", () => {
    render(
      panel([
        { domain: "farm.test", votes: 8, members: [member(1)], blockable: true, machineMade: 7 },
        { domain: "plain.test", votes: 2, members: [member(2)], blockable: true, machineMade: 0 },
      ]),
    );
    expect(screen.getByText(/7 of 8 look\s+machine-made/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/0 of 2 look/);
  });

  it("asks with the block's consequence and sends the domain and reason", async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({ ok: true, domain: "farm.test", held: 2 }),
    }));
    render(
      panel([
        { domain: "farm.test", votes: 3, members: [member(1), member(2), member(3, true)], blockable: true },
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: /farm\.test/ }));
    fireEvent.click(screen.getByRole("button", { name: "Block…" }));
    expect(screen.getByText("Give the reason first.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Why it is blocked"), { target: { value: "Catch-all" } });
    fireEvent.click(screen.getByRole("button", { name: "Block farm.test" }));
    expect(document.body.textContent).toContain(
      "New votes from farm.test and its subdomains are turned away with a neutral message, and any waiting for a code are held. The 2 counted this round are held for you to review. Voters are never told it is blocked. You can unblock it at any time.",
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, block it" }));
    });
    const [, init] = fetchMock.mock.calls.at(-1) as unknown as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({ action: "block_domain", domain: "farm.test", reason: "Catch-all" });
    expect(toast.success).toHaveBeenLastCalledWith(
      "Blocked farm.test. 2 counted votes held for you to review.",
    );
  });

  it("says why each held vote is held", () => {
    render(
      panel(
        [],
        [
          { voteId: "h1", email: "a@corp.test", domain: "corp.test", createdAt: "2026-09-27T19:13:00Z", reason: "cap" },
          { voteId: "h2", email: "b@farm.test", domain: "farm.test", createdAt: "2026-09-27T19:13:00Z", reason: "blocked" },
          { voteId: "h3", email: "c@fwd.test", domain: "fwd.test", createdAt: "2026-09-27T19:13:00Z", reason: "forwarder" },
          { voteId: "h4", email: "d@old.test", domain: "old.test", createdAt: "2026-09-27T19:13:00Z", reason: null },
        ],
      ),
    );
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/corp\.test · Over the domain's ten ·/);
    expect(text).toMatch(/farm\.test · Domain blocked ·/);
    expect(text).toMatch(/fwd\.test · Forwarding service ·/);
    // Held before reasons were recorded: the cap was the only thing that held.
    expect(text).toMatch(/old\.test · Over the domain's ten ·/);
    // And the intro names all three reasons the rows can give.
    expect(text).toContain(
      "Verified, but held: past the domain's ten, from a blocked domain, or from a forwarding service.",
    );
  });

  it("says a blocked cluster too small for Remove all is blocked, without asking a question it offers no answer to", () => {
    render(
      panel([
        { domain: "farm.test", votes: 2, members: [member(1), member(2)], blockable: true, block: "admin" },
        { domain: "fwd.test", votes: 1, members: [member(3)], blockable: true, block: "auto" },
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: /farm\.test/ }));
    expect(document.body.textContent).toContain("Blocked. Remove its votes one at a time below.");
    expect(document.body.textContent).not.toContain("look like one person?");
    expect(screen.queryByRole("button", { name: "Block…" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove all/ })).toBeNull();
    // Each vote can still be removed on its own.
    expect(screen.getAllByRole("button", { name: /^Remove/ }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /fwd\.test/ }));
    expect(document.body.textContent).toContain(
      "Blocked automatically. Remove its votes one at a time below.",
    );
  });

  it("stops Remove all past five hundred votes with what does work, before a reason is asked for", () => {
    const many = Array.from({ length: 501 }, (_, i) => member(i));
    render(panel([{ domain: "farm.test", votes: 501, members: many, blockable: true }]));
    fireEvent.click(screen.getByRole("button", { name: /farm\.test/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove all 501 as fraud…" }));
    expect(toast.error).toHaveBeenLastCalledWith(
      "That is more than five hundred votes, too many to remove in one go.",
    );
    expect(screen.queryByLabelText("Why they go")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("blocking from a round already reviewed", () => {
  /*
   * block_vote_domain holds nothing in a reviewed round: a person certified
   * its tally. The Block button stays, because the block still guards the
   * rounds after it, but the dialog and the toast must not say this
   * round's counted votes are held.
   */
  const member = (i: number) => ({
    voteId: `b${i}`,
    email: `v${i}@farm.test`,
    createdAt: "2026-09-27T19:13:00Z",
    held: false,
  });
  const round = (reviewedAt: string | null) => ({
    roundId: "r1",
    status: "closed" as const,
    opensAt: "2026-09-26T07:00:00Z",
    closesAt: "2026-09-29T07:00:00Z",
    reviewedAt,
  });
  const panel = (reviewedAt: string | null, votes = 5) => (
    <VoteRoundPanel
      weekNo={1}
      round={round(reviewedAt)}
      candidates={CANDIDATES}
      frozen
      tally={{
        nominees: [],
        domains: [
          {
            domain: "farm.test",
            votes,
            members: Array.from({ length: votes }, (_, i) => member(i + 1)),
            blockable: true,
          },
        ],
        ips: [],
        held: [],
        unverified: 0,
      }}
    />
  );
  const askToBlock = () => {
    fireEvent.click(screen.getByRole("button", { name: /farm\.test/ }));
    fireEvent.click(screen.getByRole("button", { name: "Block…" }));
    fireEvent.change(screen.getByLabelText("Why it is blocked"), { target: { value: "Farm" } });
    fireEvent.click(screen.getByRole("button", { name: "Block farm.test" }));
  };

  it("says the round's counted votes keep counting, and what takes them out", async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({ ok: true, domain: "farm.test", held: 0, already: false }),
    }));
    render(panel("2026-09-29T09:00:00Z"));
    expect(document.body.textContent).toContain("A person has looked at every held vote and cluster");
    askToBlock();
    const text = document.body.textContent ?? "";
    expect(text).toContain(
      "New votes from farm.test and its subdomains are turned away with a neutral message, and any waiting for a code are held. This round is already reviewed, so its 5 counted votes keep counting. To take them out of the tally, remove them as fraud. Voters are never told it is blocked. You can unblock it at any time.",
    );
    expect(text).not.toContain("held for you to review");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, block it" }));
    });
    expect(toast.success).toHaveBeenLastCalledWith(
      "Blocked farm.test. Its 5 counted votes this round keep counting.",
    );
  });

  it("says one vote in the singular", () => {
    render(panel("2026-09-29T09:00:00Z", 1));
    askToBlock();
    expect(document.body.textContent).toContain(
      "This round is already reviewed, so its 1 counted vote keeps counting. To take it out of the tally, remove it as fraud.",
    );
  });

  it("still promises the hold in a round nobody has reviewed", () => {
    render(panel(null));
    askToBlock();
    expect(document.body.textContent).toContain("The 5 counted this round are held for you to review.");
    expect(document.body.textContent).not.toContain("already reviewed");
  });

  it("says the domain was already blocked when the server found it so", async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({ ok: true, domain: "farm.test", held: 0, already: true }),
    }));
    render(panel(null));
    askToBlock();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, block it" }));
    });
    expect(toast.success).toHaveBeenLastCalledWith("farm.test was already blocked.");
  });
});

describe("telling the creators", () => {
  /*
   * Owner report: the email went out, and after a reload the button was
   * back. The console now reads the send from its audit row, so the button
   * gives way to what happened to it, and a new round brings it back.
   */
  type Told = { at: string; finished: boolean; sent: number | null; failed?: number | null };
  const round = (announced: Told | null, roundId = "r1") => ({
    roundId,
    status: "open" as const,
    opensAt: "2026-09-26T07:00:00Z",
    closesAt: "2026-09-29T07:00:00Z",
    reviewedAt: null,
    announced,
  });
  const panel = (r: ReturnType<typeof round>, weekNo = 1) => (
    <VoteRoundPanel weekNo={weekNo} round={r} candidates={CANDIDATES} tally={null} frozen />
  );
  const tellButton = () => screen.queryByRole("button", { name: "Tell the creators" });
  async function press(answer: { ok: boolean; status?: number; body: object }) {
    fetchMock.mockImplementationOnce(async () => ({
      ok: answer.ok,
      status: answer.status ?? 200,
      json: async () => answer.body,
    }));
    fireEvent.click(tellButton()!);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, tell them" }));
    });
  }
  beforeEach(() => nav.refresh.mockClear());

  it("offers the send while nobody has been told", () => {
    render(panel(round(null)));
    expect(tellButton()).toBeTruthy();
  });

  it("says when they were told, and how many, instead of offering it again", () => {
    render(panel(round({ at: "2026-09-26T09:05:00Z", finished: true, sent: 212, failed: 0 })));
    expect(tellButton()).toBeNull();
    expect(screen.getByText("Creators told")).toBeTruthy();
    expect(screen.getByText(/^26 Sept.*10:05 · 212 emails$/)).toBeTruthy();
    // The rest of the open vote's controls are untouched.
    expect(screen.getByRole("button", { name: "Close the vote" })).toBeTruthy();
  });

  it("does not call a send that left people out a success", () => {
    const { unmount } = render(
      panel(round({ at: "2026-09-26T09:05:00Z", finished: true, sent: 150, failed: 50 })),
    );
    expect(screen.getByText("Some not sent")).toBeTruthy();
    expect(screen.getByText(/· 150 emails, 50 failed$/)).toBeTruthy();
    expect(screen.queryByText("Creators told")).toBeNull();
    unmount();
    render(panel(round({ at: "2026-09-26T09:05:00Z", finished: true, sent: 0, failed: 400 })));
    expect(screen.getByText("Not sent")).toBeTruthy();
    expect(tellButton()).toBeNull();
  });

  it("says a send that never finished did not finish, and still does not offer another", () => {
    render(panel(round({ at: "2026-09-26T09:05:00Z", finished: false, sent: 0 })));
    expect(tellButton()).toBeNull();
    expect(screen.getByText("Not finished")).toBeTruthy();
    expect(screen.getByText(/^started 26 Sept.*10:05$/)).toBeTruthy();
  });

  it("remembers a send made on this page, at the time the server claimed it", async () => {
    render(panel(round(null)));
    await press({ ok: true, body: { ok: true, sent: 3, failed: 0, startedAt: "2026-09-26T09:00:00.000Z" } });
    expect(tellButton()).toBeNull();
    expect(screen.getByText(/^26 Sept.*10:00 · 3 emails$/)).toBeTruthy();
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("does not carry that memory to another week's round on the same page", async () => {
    // The week links change only the query string, so the panel stays
    // mounted and is handed the next round.
    const view = render(panel(round(null, "r1")));
    await press({ ok: true, body: { ok: true, sent: 3, failed: 0, startedAt: "2026-09-26T09:00:00.000Z" } });
    expect(tellButton()).toBeNull();
    view.rerender(panel(round(null, "r2"), 2));
    expect(tellButton()).toBeTruthy();
    expect(screen.queryByText("Creators told")).toBeNull();
  });

  it("refreshes after a refusal, so a page that was behind catches up", async () => {
    render(panel(round(null)));
    await press({
      ok: false,
      status: 409,
      body: { ok: false, message: "This vote has already been announced. Check the audit log to see when, and by whom." },
    });
    expect(nav.refresh).toHaveBeenCalled();
  });
});

describe("the voter's receipt", () => {
  it("names the round's close instead of a day", async () => {
    const { voteReceiptEmail } = await import("@/lib/email/templates");
    const mail = voteReceiptEmail({
      to: "v@example.test",
      nomineeName: "Ada Obi",
      weekNo: 1,
      closesAtLagos: "Tuesday, 29 September, 8:00 am",
    });
    expect(mail.text).toContain("Voting closes Tuesday, 29 September, 8:00 am, Lagos time");
    expect(mail.text).not.toMatch(/Sunday evening/);
    expect(mail.html).not.toMatch(/Sunday evening/);
  });
});

describe("telling nominees apart", () => {
  it("shows the handle behind each approved post under the name, linking to the post", () => {
    render(
      <VoteRoundPanel
        weekNo={1}
        round={null}
        frozen
        tally={null}
        candidates={[
          {
            entryId: "e1",
            name: "Ada Obi",
            points: 300,
            approvedPlatforms: 2,
            posts: [
              { platform: "x", handle: "adaobi", url: "https://x.com/adaobi/status/123" },
              { platform: "instagram", handle: null, url: "https://www.instagram.com/p/ABC/" },
            ],
          },
          { entryId: "e2", name: "Ada Obi", points: 250, approvedPlatforms: 1, posts: [
            { platform: "tiktok", handle: "ada.creates", url: "https://www.tiktok.com/@ada.creates/video/9" },
          ] },
        ]}
      />,
    );
    const x = screen.getByRole("link", { name: /@adaobi on X/ });
    expect(x.getAttribute("href")).toBe("https://x.com/adaobi/status/123");
    expect(x.getAttribute("target")).toBe("_blank");
    // No registered handle on that platform: the post is still named and linked.
    expect(screen.getByRole("link", { name: /post on Instagram/ })).toBeTruthy();
    // Two nominees with one name are now told apart by their accounts.
    expect(screen.getByRole("link", { name: /@ada\.creates on TikTok/ })).toBeTruthy();
    // The name still ticks the box, the card shows it, and the count says so.
    expect(screen.getByText("0 of 5 picked")).toBeTruthy();
    fireEvent.click(screen.getAllByText("Ada Obi")[0]);
    const box = screen.getAllByRole("checkbox")[0] as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(box.closest("label")!.className).toMatch(/border-brand-gold/);
    expect(screen.getByText("1 of 5 picked")).toBeTruthy();
  });

  it("keeps handles as quiet chips, not underlined links", () => {
    render(
      <VoteRoundPanel
        weekNo={1}
        round={null}
        frozen
        tally={null}
        candidates={[
          { entryId: "e1", name: "Ada Obi", points: 300, approvedPlatforms: 1, posts: [
            { platform: "x", handle: "adaobi", url: "https://x.com/adaobi/status/1" },
          ] },
        ]}
      />,
    );
    const chip = screen.getByRole("link", { name: /@adaobi on X/ });
    expect(chip.className).toMatch(/rounded-full/);
    expect(chip.className).not.toMatch(/underline/);
    expect(chip.getAttribute("title")).toBe("Open the approved X post");
  });
});

describe("a vote that outlives its week", () => {
  it("keeps the winners screen on a week whose vote is not finished", () => {
    const page = readFileSync(join(process.cwd(), "app/admin/(console)/winners/page.tsx"), "utf8");
    expect(page).toMatch(/unfinishedVoteWeek\(admin\.admin, current\)/);
    expect(page).toMatch(/searchParams/);
    expect(page).toMatch(/canRecord=\{weekNo === current\}/);
  });

  it("does not offer to record a past week's standings, which the server refuses", () => {
    const props = {
      weekNo: 1,
      creatorCandidates: [],
      favouriteCandidates: [],
      picked: [],
      vote: null,
    };
    const { unmount } = render(<WinnersPanel {...props} frozen canRecord={false} />);
    expect(screen.queryByRole("button", { name: /Record/ })).toBeNull();
    expect(screen.getByText(/Week 1 is over, so its standings stay as they were recorded/)).toBeTruthy();
    unmount();

    render(<WinnersPanel {...props} frozen={false} />);
    expect(screen.getByRole("button", { name: /Record the standings/ })).toBeTruthy();
  });
});
