/**
 * Rovv's console list: what a reviewer can press, what only an owner can,
 * and that ruling an entry out and emailing the winners both ask first.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RovvCodePaste, RovvNotify, RovvQueue, RovvTestTools, type RovvQueueItem } from "@/components/admin/rovv-queue";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ ok: true, status: "ineligible", winner: false, winners: 1, sent: 3, failed: 0 }),
}));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const sent = (n = 0) => {
  const call = fetchMock.mock.calls[n] as unknown[] | undefined;
  const init = call?.[1] as RequestInit | undefined;
  return { url: call?.[0], body: init?.body ? JSON.parse(String(init.body)) : undefined };
};

const item = (over: Partial<RovvQueueItem> = {}): RovvQueueItem => ({
  id: "00000000-0000-4000-8000-000000000001",
  fullName: "Ada Obi",
  email: "ada@example.test",
  tiktokHandle: "adaobi",
  tiktokUrl: "https://tiktok.com/@adaobi/video/7300000000000000001",
  referralCode: "ADA123",
  status: "pending",
  reviewNote: null,
  reviewerEmail: null,
  submittedAtLabel: "13 Oct, 09:05",
  reviewedAtLabel: null,
  winner: false,
  notifiedAtLabel: null,
  revision: 1,
  sameVideo: 0,
  isTest: false,
  ticketCode: null,
  ...over,
});

describe("an entry", () => {
  it("opens its video in a new tab, with the referrer and opener closed", () => {
    render(<RovvQueue items={[item()]} owner={false} winners={0} cap={20} />);
    const link = screen.getByRole("link", { name: /tiktok\.com\/@adaobi/ });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener noreferrer");
    expect(screen.getByText("ADA123")).toBeTruthy();
  });

  it("shows a link that is not TikTok's as text, not as a link", () => {
    render(<RovvQueue items={[item({ tiktokUrl: "https://evil.example/@adaobi/video/1" })]} owner={false} winners={0} cap={20} />);
    expect(screen.queryByRole("link", { name: /evil\.example/ })).toBeNull();
    expect(screen.getByText("https://evil.example/@adaobi/video/1")).toBeTruthy();
  });

  it("is ruled out only with a reason, which goes with the decision", async () => {
    render(<RovvQueue items={[item()]} owner={false} winners={0} cap={20} />);
    fireEvent.click(screen.getByRole("button", { name: /^Ineligible$/ }));
    const reason = screen.getByLabelText("Why this entry is ineligible");

    fireEvent.submit(reason.closest("form")!);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(reason, { target: { value: "No ROVV account with this code" } });
    fireEvent.submit(reason.closest("form")!);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({
      url: "/api/admin/rovv/decision",
      body: { entryId: item().id, status: "ineligible", note: "No ROVV account with this code", revision: 1 },
    });
  });
});

describe("picking winners", () => {
  it("is offered to an owner on an eligible entry, and to nobody else", () => {
    const { unmount } = render(<RovvQueue items={[item({ status: "eligible" })]} owner={false} winners={0} cap={20} />);
    expect(screen.queryByRole("button", { name: /Pick as winner/ })).toBeNull();
    unmount();

    render(<RovvQueue items={[item({ status: "eligible" })]} owner winners={0} cap={20} />);
    fireEvent.click(screen.getByRole("button", { name: /Pick as winner/ }));
    expect(sent()).toEqual({ url: "/api/admin/rovv/winner", body: { entryId: item().id, pick: true } });
  });

  it("is closed once every place is taken", () => {
    render(<RovvQueue items={[item({ status: "eligible" })]} owner winners={20} cap={20} />);
    const full = screen.getByRole("button", { name: /All 20 picked/ }) as HTMLButtonElement;
    expect(full.disabled).toBe(true);
  });

  it("offers no unpick, and no ruling, on a winner who has been emailed", () => {
    render(
      <RovvQueue
        items={[item({ status: "eligible", winner: true, notifiedAtLabel: "19 Oct, 10:00" })]}
        owner
        winners={1}
        cap={20}
      />,
    );
    expect(screen.queryByRole("button", { name: /Unpick/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Ineligible$/ })).toBeNull();
    expect(screen.getByText(/Winner · emailed/)).toBeTruthy();
  });
});

describe("emailing the winners", () => {
  it("asks first, saying how many will go and that fewer than all are picked", async () => {
    render(<RovvNotify untold={3} sending={0} needCode={0} winners={3} cap={20} closed />);
    fireEvent.click(screen.getByRole("button", { name: "Email the winners (3)" }));

    const question = screen.getByRole("alertdialog");
    expect(within(question).getByText("Email 3 winners now?")).toBeTruthy();
    expect(question.textContent).toContain("Only 3 of 20 are picked");
    expect(question.textContent).toContain("cannot be unpicked");
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(within(question).getByRole("button", { name: "Yes, email 3 winners" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent().url).toBe("/api/admin/rovv/notify");
  });

  it("offers nothing to press when nobody is waiting to be told", () => {
    render(<RovvNotify untold={0} sending={0} needCode={0} winners={20} cap={20} closed />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("All 20 picked so far have been emailed.")).toBeTruthy();
  });

  it("offers nothing to press before entries close, which the route would refuse", () => {
    render(<RovvNotify untold={3} sending={0} needCode={0} winners={3} cap={20} closed={false} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/once entries close/)).toBeTruthy();
  });

  it("says when winners are being emailed by another press", () => {
    render(<RovvNotify untold={0} sending={2} needCode={0} winners={2} cap={20} closed />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/2 winners are being emailed right now/)).toBeTruthy();
  });

  it("flags an entry whose video somebody else has entered too", () => {
    render(<RovvQueue items={[item({ sameVideo: 2 })]} owner={false} winners={0} cap={20} />);
    expect(screen.getByText("Same video as 2 other entries")).toBeTruthy();
  });

  it("marks an entry the entrant has replaced, and sends the revision it shows", async () => {
    render(<RovvQueue items={[item({ revision: 3 })]} owner={false} winners={0} cap={20} />);
    expect(screen.getByText("Replaced by entrant")).toBeTruthy();
    expect(screen.queryByText(/Same video/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Eligible$/ }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent().body).toMatchObject({ status: "eligible", revision: 3 });
  });
});

describe("a winner's ticket code", () => {
  it("is offered to an owner on a winner, saved with the code trimmed, and never to a reviewer", async () => {
    const { unmount } = render(<RovvQueue items={[item({ status: "eligible", winner: true })]} owner={false} winners={1} cap={20} />);
    expect(screen.queryByLabelText("Ticket code")).toBeNull();
    unmount();

    render(<RovvQueue items={[item({ status: "eligible", winner: true })]} owner winners={1} cap={20} />);
    expect(screen.getByText(/No code yet, so this winner cannot be emailed/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Ticket code"), { target: { value: "  BUIDL-9 " } });
    fireEvent.click(screen.getByRole("button", { name: "Save code" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({ url: "/api/admin/rovv/code", body: { entryId: item().id, code: "BUIDL-9" } });
  });

  it("is shown as sent, and no longer editable, once the winner has been emailed", () => {
    render(
      <RovvQueue
        items={[item({ status: "eligible", winner: true, ticketCode: "BUIDL-7", notifiedAtLabel: "19 Oct, 15:00" })]}
        owner
        winners={1}
        cap={20}
      />,
    );
    expect(screen.queryByLabelText("Ticket code")).toBeNull();
    expect(screen.getByText("BUIDL-7")).toBeTruthy();
  });

  it("lets a test winner with a code be sent the winner email, and no real one", async () => {
    const { unmount } = render(
      <RovvQueue items={[item({ status: "eligible", winner: true, ticketCode: "REAL-1" })]} owner winners={1} cap={20} />,
    );
    expect(screen.queryByRole("button", { name: /Send the winner email/ })).toBeNull();
    unmount();

    render(
      <RovvQueue items={[item({ status: "eligible", winner: true, ticketCode: "TEST-1", isTest: true })]} owner winners={1} cap={20} />,
    );
    expect(screen.getByText("Test entry")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Send the winner email to/ }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({ url: "/api/admin/rovv/test-notify", body: { entryId: item().id } });
  });

  it("lets a test entry be picked even with all 20 real winners picked", () => {
    render(<RovvQueue items={[item({ status: "eligible", isTest: true })]} owner winners={20} cap={20} />);
    expect((screen.getByRole("button", { name: /Pick as winner/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("says when picked winners are still missing a code", () => {
    render(<RovvNotify untold={0} sending={0} needCode={2} winners={2} cap={20} closed />);
    expect(screen.getByText(/2 winners have no ticket code yet/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the testing tools", () => {
  it("link to the page in test mode, and delete the tests only after asking", async () => {
    render(<RovvTestTools tests={3} />);
    expect(screen.getByRole("link", { name: /test mode/ }).getAttribute("href")).toBe("/campaigns/rovv?test=1#enter");
    fireEvent.click(screen.getByRole("button", { name: "Delete all test entries (3)" }));
    expect(fetchMock).not.toHaveBeenCalled();
    const question = screen.getByRole("alertdialog");
    fireEvent.click(within(question).getByRole("button", { name: "Yes, delete the tests" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent().url).toBe("/api/admin/rovv/test-clear");
  });

  it("offer nothing to delete when there are no tests", () => {
    render(<RovvTestTools tests={0} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("pasting all the codes", () => {
  it("says what it found as it is pasted, and gives them out only after asking", async () => {
    render(<RovvCodePaste waiting={3} />);
    fireEvent.change(screen.getByLabelText("Paste all the codes"), { target: { value: "C-1\nC-2, C-3\nC-4" } });
    expect(screen.getByText("4 codes found for 3 winners waiting: 1 will be left over.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Give 3 codes to the winners" }));
    expect(fetchMock).not.toHaveBeenCalled();
    const question = screen.getByRole("alertdialog");
    expect(question.textContent).toContain("starting with C-1");
    fireEvent.click(within(question).getByRole("button", { name: "Yes, give out 3" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({ url: "/api/admin/rovv/codes", body: { text: "C-1\nC-2, C-3\nC-4", test: false } });
  });

  it("will not offer to give out a list with a repeat or a non-code in it", () => {
    render(<RovvCodePaste waiting={3} />);
    fireEvent.change(screen.getByLabelText("Paste all the codes"), { target: { value: "C-1\nc-1" } });
    expect(screen.getByText(/In the list twice: c-1/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Give/ })).toBeNull();
    fireEvent.change(screen.getByLabelText("Paste all the codes"), { target: { value: "C-1 x!" } });
    expect(screen.getByText(/Not codes: x!/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Give/ })).toBeNull();
  });

  it("hands test codes to test winners when used from the test panel", async () => {
    render(<RovvCodePaste waiting={1} test />);
    fireEvent.change(screen.getByLabelText("Paste all the codes"), { target: { value: "T-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Give 1 code to the test winners" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Yes, give out 1" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent().body).toEqual({ text: "T-1", test: true });
  });
});
