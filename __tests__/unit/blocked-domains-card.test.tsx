import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    // The engine releases only up to the domain's allowance (0069), and the
    // dialog says so rather than implying every held vote comes back.
    expect(document.body.textContent).toContain(
      "New votes from oemails.com are accepted again. Of the 2 votes the block holds, those within its allowance of ten a round are released, oldest first; the rest wait as over the domain's ten. Votes removed as fraud stay removed and count toward that ten. Automatic blocking will not act on oemails.com again.",
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

  it("puts focus on the next row's Unblock afterwards, and on the heading after the last row", async () => {
    // The row that was unblocked leaves the list on the refresh, and its
    // button was disabled while the request ran, so focus must not be left
    // to fall to the page body.
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ ok: true, released: 0 }),
    }));
    render(<BlockedDomainsCard blocks={BLOCKS} />);
    const unblockRow = async (index: number, domain: string) => {
      fireEvent.click(screen.getAllByRole("button", { name: "Unblock…" })[index]);
      fireEvent.change(screen.getByLabelText("Why it is safe again"), { target: { value: "x" } });
      fireEvent.click(screen.getByRole("button", { name: `Unblock ${domain}` }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Yes, unblock it" }));
      });
    };

    await unblockRow(0, "oemails.com");
    const [, next] = screen.getAllByRole("button", { name: "Unblock…" });
    await waitFor(() => expect(document.activeElement).toBe(next));

    await unblockRow(2, "fwd.test");
    const heading = screen.getByRole("heading", { name: "Blocked domains" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(heading.getAttribute("tabindex")).toBe("-1");
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ ok: true }) as object }));
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

  /** Press Block… and let the suffix list load, as the card does on demand. */
  const ask = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Block…" }));
    });
  };

  it("folds a pasted address onto the domain the block covers, names it throughout, and sends it", async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({ ok: true, domain: "farm.test", held: 0, already: false }),
    }));
    render(<BlockedDomainsCard blocks={[]} />);
    type("  Someone@Mail.Farm.test ");
    await ask();
    // The dialog names the registrable domain, not the host that was typed.
    expect(await screen.findByRole("heading", { name: "Block farm.test" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Why it is blocked"), {
      target: { value: "Next domain on the same host" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Block farm.test" }));
    expect(document.body.textContent).toContain("Block farm.test for the rest of the campaign?");
    // Nothing is counted from it yet that the console knows of.
    expect(document.body.textContent).toContain(
      "mail.farm.test belongs to farm.test; the block covers all of farm.test. New votes from farm.test and its subdomains are turned away with a neutral message, and any waiting for a code are held. Any counted this round are held for you to review.",
    );
    expect(document.body.textContent).not.toContain("New votes from mail.farm.test");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, block it" }));
    });
    expect(lastBody()).toEqual({
      action: "block_domain",
      domain: "farm.test",
      reason: "Next domain on the same host",
    });
    expect(toast.success).toHaveBeenLastCalledWith("Blocked farm.test.");
    // And focus lands on the card, not the page body: the Block… button
    // that opened the dialog is disabled now that the field is empty.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Blocked domains" })),
    );
  });

  it("says when a campus subdomain blocks the whole campus", async () => {
    render(<BlockedDomainsCard blocks={[]} />);
    type("cs.unilag.edu.ng");
    await ask();
    fireEvent.change(await screen.findByLabelText("Why it is blocked"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Block unilag.edu.ng" }));
    expect(document.body.textContent).toContain(
      "cs.unilag.edu.ng belongs to unilag.edu.ng; the block covers all of unilag.edu.ng.",
    );
    expect(document.body.textContent).toContain("Block unilag.edu.ng for the rest of the campaign?");
  });

  it("does not add the folding sentence when the domain was typed as it is", async () => {
    render(<BlockedDomainsCard blocks={[]} />);
    type("farm.test");
    await ask();
    fireEvent.change(await screen.findByLabelText("Why it is blocked"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Block farm.test" }));
    expect(document.body.textContent).not.toContain("the block covers all of");
  });

  it("says a school or government domain will turn real people away", async () => {
    render(<BlockedDomainsCard blocks={[]} />);
    type("unilag.edu.ng");
    await ask();
    fireEvent.change(await screen.findByLabelText("Why it is blocked"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Block unilag.edu.ng" }));
    expect(document.body.textContent).toContain(
      "unilag.edu.ng looks like a school or government domain. Real students and staff will be turned away.",
    );
  });

  it("refuses what is not a domain before the round trip", async () => {
    render(<BlockedDomainsCard blocks={[]} />);
    type("not a domain");
    await ask();
    expect(screen.getByRole("alert").textContent).toBe(
      "That is not a domain. Type it as example.com.",
    );
    expect(screen.queryByLabelText("Why it is blocked")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a public suffix, or an address with no domain of its own, as a field error", async () => {
    for (const typed of ["edu.ng", "com.ng", "10.0.0.1"]) {
      const { unmount } = render(<BlockedDomainsCard blocks={[]} />);
      type(typed);
      await ask();
      expect(screen.getByRole("alert").textContent, typed).toBe(
        "That is a suffix many domains share, not one domain.",
      );
      expect(screen.queryByLabelText("Why it is blocked")).toBeNull();
      unmount();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says a domain is already blocked, or already covered by its parent's block", async () => {
    for (const [typed, message] of [
      ["fwd.test", "fwd.test is already blocked."],
      ["someone@x.oemails.com", "oemails.com is already blocked."],
    ]) {
      const { unmount } = render(<BlockedDomainsCard blocks={BLOCKS} />);
      type(typed);
      await ask();
      expect(screen.getByRole("alert").textContent, typed).toBe(message);
      expect(screen.queryByLabelText("Why it is blocked")).toBeNull();
      unmount();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says so when the server found the domain already blocked, instead of claiming a block", async () => {
    // Another owner blocked it after this page loaded.
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({ ok: true, domain: "farm.test", held: 0, already: true }),
    }));
    render(<BlockedDomainsCard blocks={[]} />);
    type("farm.test");
    await ask();
    fireEvent.change(await screen.findByLabelText("Why it is blocked"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Block farm.test" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, block it" }));
    });
    expect(toast.success).toHaveBeenLastCalledWith("farm.test was already blocked.");
  });
});
