/**
 * Rovv's console list: what a reviewer can press, what only an owner can,
 * and that ruling an entry out and emailing the winners both ask first.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RovvCodePaste,
  RovvNotify,
  RovvQueue,
  RovvResults,
  RovvRuleOut,
  RovvTestTools,
  type RovvQueueItem,
} from "@/components/admin/rovv-queue";

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
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

/** The next answer from the server, for one press. */
const answerOnce = (body: Record<string, unknown>) =>
  fetchMock.mockImplementationOnce(async () => ({ ok: true, json: async () => body }) as never);
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
      body: { entryId: item().id, status: "ineligible", note: "No ROVV account with this code", revision: 1, from: "pending" },
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

describe("the end-to-end walk's console fixes", () => {
  it("flags the same username or referral code on another entry", () => {
    render(<RovvQueue items={[item({ sameHandle: 1, sameReferral: 2 })]} owner={false} winners={0} cap={20} />);
    expect(screen.getByText("Same TikTok username as 1 other entry")).toBeTruthy();
    expect(screen.getByText("Same referral code as 2 other entries")).toBeTruthy();
  });

  it("offers the common reasons in one tap, and the box stays editable", () => {
    render(<RovvQueue items={[item()]} owner={false} winners={0} cap={20} />);
    fireEvent.click(screen.getByRole("button", { name: /^Ineligible$/ }));
    fireEvent.click(screen.getByRole("button", { name: /does not tag @rovvafrica/ }));
    expect((screen.getByLabelText("Why this entry is ineligible") as HTMLInputElement).value).toMatch(/does not tag @rovvafrica/);
  });

  it("asks for a second tap before unpicking a winner who holds a code, and names the code", async () => {
    render(<RovvQueue items={[item({ status: "eligible", winner: true, ticketCode: "CODE-9" })]} owner winners={1} cap={20} />);
    fireEvent.click(screen.getByRole("button", { name: "Unpick winner" }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Tap again to unpick: CODE-9 becomes free/ }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({ url: "/api/admin/rovv/winner", body: { entryId: item().id, pick: false } });
  });

  it("lets an owner correct a username or email, sending only what changed", async () => {
    render(<RovvQueue items={[item()]} owner winners={0} cap={20} />);
    fireEvent.click(screen.getByRole("button", { name: "Correct username or email" }));
    fireEvent.change(screen.getByLabelText("TikTok username"), { target: { value: "@right.name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({ url: "/api/admin/rovv/correct", body: { entryId: item().id, tiktokHandle: "right.name" } });
  });

  it("shows who gets which code before handing a pasted list out", () => {
    render(<RovvCodePaste waiting={2} queue={["ada", "bola"]} />);
    fireEvent.change(screen.getByLabelText("Paste all the codes"), { target: { value: "C-1\nC-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Give 2 codes to the winners" }));
    expect(screen.getByRole("alertdialog").textContent).toContain("@ada gets C-1, @bola gets C-2");
  });

  it("asks ROVV's question before any winner email goes", () => {
    render(<RovvNotify untold={3} sending={0} needCode={0} winners={3} cap={20} closed />);
    fireEvent.click(screen.getByRole("button", { name: "Email the winners (3)" }));
    expect(screen.getByRole("alertdialog").textContent).toMatch(/Has ROVV confirmed every winner's referral code/);
  });

  it("offers the results email only with people to send it to, and asks first", async () => {
    const { unmount } = render(<RovvResults toSend={0} sent={40} />);
    expect(screen.getByText(/has gone to 40 entrants/)).toBeTruthy();
    unmount();
    render(<RovvResults toSend={12} sent={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Email the results to 12 who did not win" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Yes, email 12" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent().url).toBe("/api/admin/rovv/results");
  });
});

describe("a ruling the entrant never heard about", () => {
  it("is flagged Not emailed, with how to send it again", () => {
    render(<RovvQueue items={[item({ status: "ineligible", reviewNote: "Not public", rulingEmailed: null })]} owner={false} winners={0} cap={20} />);
    expect(screen.getByText("Not emailed")).toBeTruthy();
    expect(screen.getByText(/Move it back to waiting and rule again to send it/)).toBeTruthy();
  });

  it("is not flagged once the entrant has had that ruling, while waiting, or when nothing is known", () => {
    const cases: Partial<RovvQueueItem>[] = [
      { status: "ineligible", reviewNote: "Not public", rulingEmailed: "ineligible" },
      { status: "eligible", rulingEmailed: "eligible" },
      { status: "pending", rulingEmailed: null },
      { status: "pending", rulingEmailed: "eligible" },
      { status: "eligible" },
    ];
    for (const over of cases) {
      const { unmount } = render(<RovvQueue items={[item(over)]} owner={false} winners={0} cap={20} />);
      expect(screen.queryByText("Not emailed"), JSON.stringify(over)).toBeNull();
      unmount();
    }
  });

  it("does not tell an owner to move a picked winner back to waiting", () => {
    render(<RovvQueue items={[item({ status: "eligible", winner: true, rulingEmailed: null })]} owner winners={1} cap={20} />);
    expect(screen.getByText("Not emailed")).toBeTruthy();
    expect(screen.getByText(/Their winner email will tell them/)).toBeTruthy();
    expect(screen.queryByText(/Move it back to waiting/)).toBeNull();
  });

  it("flags the opposite ruling having been emailed", () => {
    render(<RovvQueue items={[item({ status: "ineligible", reviewNote: "Not public", rulingEmailed: "eligible" })]} owner={false} winners={0} cap={20} />);
    expect(screen.getByText("Not emailed")).toBeTruthy();
  });

  it("does not flag an eligible ruling made after the winners went out, which is not emailed on purpose", () => {
    const { unmount } = render(<RovvQueue items={[item({ status: "eligible", rulingEmailed: null })]} owner={false} winners={0} cap={20} />);
    expect(screen.getByText("Not emailed")).toBeTruthy();
    unmount();

    render(
      <RovvQueue
        items={[item({ status: "eligible", rulingEmailed: null }), item({ id: "00000000-0000-4000-8000-000000000002", status: "ineligible", reviewNote: "x", rulingEmailed: null })]}
        owner={false}
        winners={0}
        cap={20}
        announced
      />,
    );
    // The ruling-out is still owed its email; only the eligible one is let off.
    expect(screen.getAllByText("Not emailed")).toHaveLength(1);
  });

  it("says in red when a ruling's email did not send", async () => {
    answerOnce({ ok: true, status: "eligible", winner: false, emailed: false, emailFailed: true });
    render(<RovvQueue items={[item()]} owner={false} winners={0} cap={20} />);
    fireEvent.click(screen.getByRole("button", { name: /^Eligible$/ }));
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("The email did not send. Move it back to waiting and rule again to retry."),
    );
    // The ruling itself went through, and the green toast says so without claiming the email.
    expect(String(vi.mocked(toast.success).mock.calls[0]?.[0])).toMatch(/^Eligible: Ada Obi/);
    expect(String(vi.mocked(toast.success).mock.calls[0]?.[0])).not.toMatch(/emailed|No email/);
  });

  it("stays quiet in red when the email went", async () => {
    answerOnce({ ok: true, status: "eligible", winner: false, emailed: true });
    render(<RovvQueue items={[item()]} owner={false} winners={0} cap={20} />);
    fireEvent.click(screen.getByRole("button", { name: /^Eligible$/ }));
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(toast.error).not.toHaveBeenCalled();
    expect(String(vi.mocked(toast.success).mock.calls[0]?.[0])).toContain("The entrant has been emailed.");
  });
});

describe("a judge's note", () => {
  it("is tucked behind Add a note, and goes with Eligible", async () => {
    render(<RovvQueue items={[item()]} owner={false} winners={0} cap={20} />);
    expect(screen.queryByLabelText("Judge's note (not emailed)")).toBeNull();
    const toggle = screen.getByRole("button", { name: "Add a note" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);

    fireEvent.change(screen.getByLabelText("Judge's note (not emailed)"), { target: { value: "  Best hook so far  " } });
    fireEvent.click(screen.getByRole("button", { name: /^Eligible$/ }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({
      url: "/api/admin/rovv/decision",
      body: { entryId: item().id, status: "eligible", note: "Best hook so far", revision: 1, from: "pending" },
    });
  });

  it("is not sent once removed, nor while the reason box is open", async () => {
    render(<RovvQueue items={[item()]} owner={false} winners={0} cap={20} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a note" }));
    fireEvent.change(screen.getByLabelText("Judge's note (not emailed)"), { target: { value: "Shortlist" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove the note" }));
    expect(screen.queryByLabelText("Judge's note (not emailed)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Eligible$/ }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent().body).not.toHaveProperty("note");
  });

  it("is hidden while ruling an entry out, and never offered on an eligible one", () => {
    const { unmount } = render(<RovvQueue items={[item()]} owner={false} winners={0} cap={20} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a note" }));
    fireEvent.click(screen.getByRole("button", { name: /^Ineligible$/ }));
    expect(screen.queryByLabelText("Judge's note (not emailed)")).toBeNull();
    expect(screen.queryByRole("button", { name: /Add a note|Remove the note/ })).toBeNull();
    unmount();

    render(<RovvQueue items={[item({ status: "eligible" })]} owner winners={0} cap={20} />);
    expect(screen.queryByRole("button", { name: "Add a note" })).toBeNull();
  });

  it("shows on an eligible card as the team's, not the entrant's", () => {
    render(<RovvQueue items={[item({ status: "eligible", reviewNote: "Best hook so far" })]} owner winners={0} cap={20} />);
    expect(screen.getByText("Best hook so far")).toBeTruthy();
    expect(screen.getByText(/Judge's note, not emailed/)).toBeTruthy();
  });

  it("is not how an ineligible reason is labelled: that one was emailed", () => {
    render(<RovvQueue items={[item({ status: "ineligible", reviewNote: "Not public", rulingEmailed: "ineligible" })]} owner winners={0} cap={20} />);
    expect(screen.getByText("Not public")).toBeTruthy();
    expect(screen.queryByText(/Judge's note/)).toBeNull();
  });
});

describe("ruling out what ROVV could not confirm", () => {
  const field = () => screen.getByLabelText("Paste the emails ROVV could not confirm");

  it("counts the addresses as they are pasted, once each, and asks before anything is sent", async () => {
    render(<RovvRuleOut />);
    expect(screen.queryByRole("button", { name: /Rule out/ })).toBeNull();

    const text = "Ada Obi, Ada@Example.test, ADA123\n<bola@example.test>; ada+rovv@example.test\nnot-an-address";
    fireEvent.change(field(), { target: { value: text } });
    expect(screen.getByText("2 email addresses found.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Rule out up to 2 entries" }));
    expect(fetchMock).not.toHaveBeenCalled();
    const question = screen.getByRole("alertdialog");
    expect(within(question).getByText("Rule out the entries under these 2 email addresses?")).toBeTruthy();
    expect(question.textContent).toContain("ROVV could not confirm your referral code.");
    expect(question.textContent).toContain("Picked winners are left alone");

    answerOnce({ ok: true, ruledOut: 2, alreadyOut: 0, winners: [], unmatched: [], notRuled: [], emailed: 2, emailFailed: 0, left: 0 });
    fireEvent.click(within(question).getByRole("button", { name: "Yes, rule out up to 2" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual({ url: "/api/admin/rovv/rule-out", body: { emails: text } });
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ruled out 2 entries. Emailed 2."));
    expect(toast.error).not.toHaveBeenCalled();
    expect((field() as HTMLTextAreaElement).value).toBe("");
  });

  it("says when nothing pasted is an address, and offers nothing to press", () => {
    render(<RovvRuleOut />);
    fireEvent.change(field(), { target: { value: "Ada Obi ADA123" } });
    expect(screen.getByText("No email addresses found yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Rule out/ })).toBeNull();
  });

  it("names the winners left alone and the addresses with no entry, and keeps them in the box", async () => {
    render(<RovvRuleOut />);
    fireEvent.change(field(), { target: { value: "ada@example.test\nwon@example.test\nnobody@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Rule out up to 3 entries" }));
    answerOnce({
      ok: true,
      ruledOut: 1,
      alreadyOut: 0,
      winners: [{ handle: "wonit", email: "won@example.test" }],
      unmatched: ["nobody@example.test"],
      notRuled: [{ handle: "moved", email: "moved@example.test" }],
      unsent: [{ handle: "ada", email: "ada@example.test" }],
      emailed: 0,
      emailFailed: 1,
      left: 0,
    });
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Yes, rule out up to 3" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith("Ruled out 1 entry. Emailed 0.");
    const attention = String(vi.mocked(toast.error).mock.calls[0][0]);
    expect(attention).toContain("1 email did not send (@ada): they are kept in the box, and pressing again resends them.");
    expect(attention).toContain("Picked winners, not ruled out: @wonit. Unpick them first");
    expect(attention).toContain("Changed while this ran, not ruled out: @moved.");
    expect(attention).toContain("No entry for: nobody@example.test.");
    // Everything that still needs the owner stays in the box, to paste again.
    expect((field() as HTMLTextAreaElement).value).toBe(
      "won@example.test\nmoved@example.test\nada@example.test\nnobody@example.test",
    );
  });

  it("keeps the whole list when the press ran out of time, to press again", async () => {
    render(<RovvRuleOut />);
    fireEvent.change(field(), { target: { value: "a@example.test b@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Rule out up to 2 entries" }));
    answerOnce({ ok: true, ruledOut: 1, alreadyOut: 0, winners: [], unmatched: [], notRuled: [], emailed: 1, emailFailed: 0, left: 1 });
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Yes, rule out up to 2" }));
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ruled out 1 entry. Emailed 1. 1 still to go: press again."));
    expect((field() as HTMLTextAreaElement).value).toBe("a@example.test b@example.test");
  });

  it("does not say nothing happened when the press was cut off", async () => {
    render(<RovvRuleOut />);
    fireEvent.change(field(), { target: { value: "a@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Rule out up to 1 entry" }));
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 502, json: async () => { throw new Error("not JSON"); } }) as never);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Yes, rule out up to 1" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/may have partly gone through/)));
  });
});

describe("the quick reasons", () => {
  it("include the age rule", () => {
    render(<RovvQueue items={[item()]} owner={false} winners={0} cap={20} />);
    fireEvent.click(screen.getByRole("button", { name: /^Ineligible$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Entrants must be 18 or over." }));
    expect((screen.getByLabelText("Why this entry is ineligible") as HTMLInputElement).value).toBe("Entrants must be 18 or over.");
  });
});
