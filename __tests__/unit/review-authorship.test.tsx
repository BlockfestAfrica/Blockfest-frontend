/**
 * The review queue must not vouch for who published a post.
 *
 * It used to. An X or TikTok link whose path carried the registered handle was
 * filed under "Account matches", given a green edge and captioned "The link
 * names this account". That handle is typed by whoever submits the link, and
 * nothing ties it to the post: post_identity_of keys the post on the number at
 * the end alone. So a creator registered as @thief could file
 * x.com/thief/status/<somebody else's post>, pass submit_entry's wrong_account
 * check, which compares the name the thief typed, and reach the reviewer
 * already marked as matching.
 *
 * Nothing the server holds can say who published a post, so these render the
 * real queue page with exactly that link and pin that the only authorship
 * check left is a person looking at the author the platform shows.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminQueuePage from "@/app/admin/(console)/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/admin/session", () => ({
  requireAdmin: async () => ({ ok: true, admin: { adminId: "a" } }),
}));

/*
 * A creator registered as @thief, and somebody else's post under that name.
 * Hoisted because the mock below is, and it has to exist before the page is
 * imported.
 */
const { BORROWED } = vi.hoisted(() => ({
  BORROWED: {
    id: "11111111-1111-1111-1111-111111111111",
    platform: "x",
    url: "https://x.com/thief/status/4242",
    submittedAt: new Date("2026-09-25T10:00:00Z"),
    challengeTitle: "Your first salary",
    weekNo: 2,
    entryId: "22222222-2222-2222-2222-222222222222",
    creatorName: "Tobi Ade",
    registeredHandle: "thief",
    contested: false,
  },
}));

vi.mock("@/lib/admin/review", () => ({
  pendingCount: async () => 1,
  pendingSubmissions: async () => [BORROWED],
}));

/*
 * Called the way Next calls it, with searchParams, which Next passes to every
 * page whether the page reads them or not.
 */
const page: (props: {
  searchParams: Promise<Record<string, string>>;
}) => Promise<ReactNode> = AdminQueuePage;

async function openBorrowedRow() {
  render(await page({ searchParams: Promise.resolve({}) }));
  fireEvent.click(screen.getByRole("button", { name: /Tobi Ade/ }));
}

/*
 * Comments stripped: this codebase explains itself in prose, and the prose
 * around the queue names the very things these assertions say are gone.
 */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
const read = (p: string) =>
  codeOnly(readFileSync(join(process.cwd(), p), "utf8"));

describe("an X link carrying the registered handle", () => {
  it("is not presented as proof of who published it", async () => {
    await openBorrowedRow();
    expect(screen.queryByText(/names this account/i)).toBeNull();
    expect(screen.queryByText(/account matches/i)).toBeNull();
  });

  it("tells the reviewer to check the author the platform shows", async () => {
    await openBorrowedRow();
    const instruction = screen.getByText(/author the platform shows is/i);
    // Named, so the comparison is against the account on file rather than
    // against whatever name the link happens to carry.
    expect(instruction.textContent).toContain("@thief");
  });

  it("is not painted as checked", async () => {
    await openBorrowedRow();
    const row = screen.getByRole("button", { name: /Tobi Ade/ }).closest("li");
    expect(row?.className ?? "").not.toMatch(/green/);
  });
});

describe("the queue's sources", () => {
  it("no longer sort rows by the handle in the link", () => {
    // authorFromUrl still gates submission, where it catches a rival's link
    // pasted as it is. It has no say in how a row is presented.
    const pageSrc = read("app/admin/(console)/page.tsx");
    expect(pageSrc).not.toContain("authorFromUrl");
    expect(pageSrc).not.toContain("autoChecked");
    expect(read("components/admin/review-queue.tsx")).not.toContain(
      "autoChecked",
    );
  });
});
