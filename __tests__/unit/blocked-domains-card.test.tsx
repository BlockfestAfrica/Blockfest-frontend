import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { BlockedDomainsCard, type BlockedDomainView } from "@/components/admin/blocked-domains-card";

/*
 * The Blocked domains card on /admin/winners.
 *
 * It is where a block is lifted, and where a domain is blocked before any
 * vote has come from it. Both are owner acts with a reason recorded, and
 * both say exactly what they will do before they do it, because an unblock
 * releases votes into the tally and a block turns real people away if it
 * lands on the wrong domain.
 */

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: nav.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) as object }));
beforeEach(() => {
  fetchMock.mockClear();
  nav.refresh.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const BLOCKS: BlockedDomainView[] = [
  {
    domain: "oemails.com",
    source: "admin",
    reason: "Catch-all farm",
    evidence: null,
    createdAt: "2026-09-27T19:30:00Z",
    byYou: true,
    by: "owner@example.test",
    held: 2,
  },
  {
    domain: "other.test",
    source: "admin",
    reason: "Same farm, second domain",
    evidence: null,
    createdAt: "2026-09-27T19:40:00Z",
    byYou: false,
    by: "second.owner@example.test",
    held: 0,
  },
  {
    domain: "fwd.test",
    source: "auto",
    reason: "Automatic",
    evidence: "Forwarding service (route1.mx.cloudflare.net), 3 verified votes this round",
    createdAt: "2026-09-27T19:50:00Z",
    byYou: false,
    by: null,
    held: 3,
  },
];

const lastBody = () => {
  const [, init] = fetchMock.mock.calls.at(-1) as unknown as [string, { body: string }];
  return JSON.parse(init.body);
};

describe("the list of blocks", () => {
  it("leads each row with the domain and says who blocked it, why and when", () => {
    render(<BlockedDomainsCard blocks={BLOCKS} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((r) => r.querySelector("p")?.textContent)).toEqual([
      "oemails.com",
      "other.test",
      "fwd.test",
    ]);
    expect(rows[0].textContent).toMatch(/Blocked by you · Catch-all farm · 27 Sept.* · 2 held/);
    expect(rows[1].textContent).toMatch(/Blocked by second\.owner@example\.test · Same farm, second domain ·/);
    expect(rows[2].textContent).toMatch(
      /Blocked automatically · Forwarding service \(route1\.mx\.cloudflare\.net\), 3 verified votes this round ·/,
    );
  });

  it("puts who decided on the row's left edge: red for an owner, amber for the automatic rule", () => {
    render(<BlockedDomainsCard blocks={BLOCKS} />);
    const [mine, theirs, automatic] = screen.getAllByRole("listitem");
    expect(mine.className).toMatch(/border-l-2/);
    expect(mine.className).toMatch(/border-l-red-400/);
    expect(theirs.className).toMatch(/border-l-red-400/);
    expect(automatic.className).toMatch(/border-l-amber-400/);
    expect(screen.getByText("3 blocked")).toBeTruthy();
    expect(screen.getByText("1 automatic")).toBeTruthy();
  });

  it("says so when nothing is blocked", () => {
    render(<BlockedDomainsCard blocks={[]} />);
    expect(screen.getByText(/No domain is blocked\./)).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("keeps every control at least 44px tall", () => {
    render(<BlockedDomainsCard blocks={BLOCKS} />);
    for (const button of screen.getAllByRole("button")) {
      expect(button.className, button.textContent ?? "").toMatch(/\bmin-h-1[1-9]\b/);
    }
  });
});

describe("unblocking", () => {
  it("asks for a reason, says what it releases, and sends the stored domain", async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({ ok: true, domain: "oemails.com", released: 2 }),
    }));
    render(<BlockedDomainsCard blocks={BLOCKS} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Unblock…" })[0]);
    expect(screen.getByText("Give the reason first.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Why it is safe again"), {
      target: { value: "A real school club" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unblock oemails.com" }));
    expect(document.body.textContent).toContain(
      "New votes from oemails.com are accepted again, and the 2 votes the block held this round are released. Votes removed as fraud stay removed and still use up its allowance of ten this round. Automatic blocking will not act on oemails.com again.",
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, unblock it" }));
    });
    expect(lastBody()).toEqual({
      action: "unblock_domain",
      domain: "oemails.com",
      reason: "A real school club",
    });
    expect(toast.success).toHaveBeenLastCalledWith("Unblocked oemails.com. 2 held votes released.");
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("says the server's refusal instead of claiming success", async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      json: async () => ({
        ok: false,
        message: "That domain is not blocked any more. Reload to see the current list.",
      }),
    }));
    render(<BlockedDomainsCard blocks={BLOCKS} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Unblock…" })[1]);
    fireEvent.change(screen.getByLabelText("Why it is safe again"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Unblock other.test" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, unblock it" }));
    });
    expect(toast.error).toHaveBeenLastCalledWith(
      "That domain is not blocked any more. Reload to see the current list.",
    );
  });
});

describe("blocking a domain before anybody uses it", () => {
  const type = (value: string) =>
    fireEvent.change(screen.getByLabelText("Block a domain before anyone uses it"), {
      target: { value },
    });

  it("reads a pasted address for its domain, asks, and sends it", async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      // The server folds a subdomain onto its registrable domain.
      json: async () => ({ ok: true, domain: "farm.test", held: 0 }),
    }));
    render(<BlockedDomainsCard blocks={[]} />);
    type("  Someone@Mail.Farm.test ");
    fireEvent.click(screen.getByRole("button", { name: "Block…" }));
    fireEvent.change(screen.getByLabelText("Why it is blocked"), {
      target: { value: "Next domain on the same host" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Block mail.farm.test" }));
    // Nothing is counted from it yet that the console knows of.
    expect(document.body.textContent).toContain(
      "New votes from mail.farm.test and its subdomains are turned away with a neutral message, and any waiting for a code are held. Any counted this round are held for you to review.",
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, block it" }));
    });
    expect(lastBody()).toEqual({
      action: "block_domain",
      domain: "mail.farm.test",
      reason: "Next domain on the same host",
    });
    expect(toast.success).toHaveBeenLastCalledWith("Blocked farm.test.");
  });

  it("says a school or government domain will turn real people away", () => {
    render(<BlockedDomainsCard blocks={[]} />);
    type("unilag.edu.ng");
    fireEvent.click(screen.getByRole("button", { name: "Block…" }));
    fireEvent.change(screen.getByLabelText("Why it is blocked"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Block unilag.edu.ng" }));
    expect(document.body.textContent).toContain(
      "unilag.edu.ng looks like a school or government domain. Real students and staff will be turned away.",
    );
  });

  it("refuses what is not a domain before the round trip", () => {
    render(<BlockedDomainsCard blocks={[]} />);
    type("not a domain");
    fireEvent.click(screen.getByRole("button", { name: "Block…" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "That is not a domain. Type it as example.com.",
    );
    expect(screen.queryByLabelText("Why it is blocked")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
