/**
 * The creator page in the ballot's anatomy.
 *
 * The owner approved the ballot and called the rest of the signed-in page
 * ugly next to it, so /me was rebuilt in its shape: one card per section, a
 * row per platform with one action at its right hand, the form opening in
 * place. These walk the rows the way a creator would and pin what the
 * rebuild had to keep: the same request on Submit, the same question before
 * Take back, one form open at a time, and each figure said once where it
 * belongs.
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WeekRows, type WeekRow } from "@/components/campaigns/week-rows";
import { AccountRows, type AddReadyWhen } from "@/components/campaigns/account-rows";
import { EntryHistory, type EntryRow } from "@/components/campaigns/entry-history";
import { MeDashboard, type MeDashboardProps } from "@/components/campaigns/me-dashboard";
import type { CreatorSubmission } from "@/lib/creator-session";
import { closingAt } from "@/lib/format";
import { monicaRoutes } from "@/lib/campaigns";
import { CAMPAIGN_EVENTS } from "@/lib/sabilytics";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/sabilytics", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/sabilytics")>()),
  track: vi.fn(),
}));
// A server action; the page only hands it to the sign-out form.
vi.mock("@/app/campaigns/monica-money-story/enter/confirm/actions", () => ({
  signOut: vi.fn(async () => {}),
}));

const { toast } = await import("sonner");
const { track } = await import("@/lib/sabilytics");

const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));

beforeEach(() => {
  fetchMock.mockClear();
  refresh.mockClear();
  vi.mocked(track).mockClear();
  vi.mocked(toast.success).mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** The clock at a Lagos instant; only Date is faked, so React still runs. */
function clockAt(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

/** A fetch that stays in flight until the test lets it answer. */
function heldFetch() {
  let answer!: (ok: boolean) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        answer = (ok) => resolve({ ok, json: async () => ({ ok, message: ok ? undefined : "No." }) });
      }) as never,
  );
  return (ok: boolean) => answer(ok);
}

/**
 * What Chrome does to a focused button that becomes disabled mid-request:
 * focus drops to the body. jsdom leaves it on the disabled button, which is
 * how a test once passed while a real browser lost the reader's place, and
 * its blur() ignores a disabled button too, so the drop is done by hand: a
 * tabindex makes it blurrable for that one call.
 */
function dropFocusLikeChrome(button: HTMLElement) {
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(document.activeElement).toBe(button);
  button.setAttribute("tabindex", "-1");
  button.blur();
  button.removeAttribute("tabindex");
  expect(document.activeElement).toBe(document.body);
}

/** A control outside the rows, somewhere the creator can move on to. */
const Elsewhere = () => (
  <button type="button" data-testid="elsewhere">
    Elsewhere
  </button>
);

/** The nth fetch call's path and JSON body. */
function sent(n = 0) {
  const [path, init] = (fetchMock.mock.calls[n] as unknown[] | undefined) ?? [];
  const body = (init as RequestInit | undefined)?.body;
  return { path, body: body ? JSON.parse(String(body)) : undefined };
}

const ROWS: WeekRow[] = [
  { platform: "x", handle: "adaobi_writes", entry: null, canSubmit: true },
  {
    platform: "instagram",
    handle: "ada.obi",
    entry: { id: "s-2b", status: "pending", url: "https://www.instagram.com/reel/p/", reviewNote: null },
    canSubmit: false,
  },
  { platform: "tiktok", handle: "adaobi", entry: null, canSubmit: true },
];

const week = (rows = ROWS, statusKnown = true, canResend = true) =>
  render(
    <WeekRows
      rows={rows}
      weekNo={2}
      challengeTitle="Show Them How It Moves"
      statusKnown={statusKnown}
      canResend={canResend}
    />,
  );

const linkFields = () => screen.queryAllByLabelText("Public link to your post");

describe("the week's rows", () => {
  it("keeps one form open: opening another row closes the first", () => {
    week();
    fireEvent.click(screen.getByRole("button", { name: "Submit your X post" }));
    expect(linkFields()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Submit your TikTok post" }));
    expect(linkFields()).toHaveLength(1);
    expect(linkFields()[0].id).toBe("url-tiktok");
    // Take back is the same one-at-a-time: it closes the open form too.
    fireEvent.click(screen.getByRole("button", { name: "Take back your Instagram post for week 2" }));
    expect(linkFields()).toHaveLength(0);
    expect(document.body.textContent).toContain("Taking this back frees Instagram for week 2");
  });

  it("opens the form for the row pressed, naming that account, and posts what the old form posted", async () => {
    week();
    fireEvent.click(screen.getByRole("button", { name: "Submit your TikTok post" }));
    const field = screen.getByLabelText("Public link to your post") as HTMLInputElement;
    expect(document.activeElement).toBe(field);
    expect(document.body.textContent).toContain(
      "It has to be a post from @adaobi, the TikTok account you registered.",
    );
    fireEvent.change(field, { target: { value: "https://www.tiktok.com/@adaobi/video/1" } });
    fireEvent.change(field, { target: { value: "https://www.tiktok.com/@adaobi/video/12" } });
    // Started once, however many keystrokes.
    expect(vi.mocked(track).mock.calls).toEqual([[CAMPAIGN_EVENTS.submissionStarted]]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit this entry" }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent()).toEqual({
      path: "/api/campaigns/monica/submit",
      body: { platform: "tiktok", url: "https://www.tiktok.com/@adaobi/video/12" },
    });
    expect(track).toHaveBeenLastCalledWith(CAMPAIGN_EVENTS.submissionCompleted);
    expect(toast.success).toHaveBeenCalledWith("Submitted for Show Them How It Moves");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(linkFields()).toHaveLength(0);
  });

  it("shows a refusal in the server's words and keeps the form", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ ok: false, field: "url", message: "That link is not from @adaobi." }),
    } as never);
    week();
    fireEvent.click(screen.getByRole("button", { name: "Submit your TikTok post" }));
    fireEvent.change(screen.getByLabelText("Public link to your post"), {
      target: { value: "https://www.tiktok.com/@someone/video/1" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit this entry" }));
    });
    expect(screen.getByRole("alert").textContent).toBe("That link is not from @adaobi.");
    expect(refresh).not.toHaveBeenCalled();
    expect(linkFields()).toHaveLength(1);
    // A failure leaves focus where the form put it; the row's slot does not take it.
    expect(document.activeElement).toBe(screen.getByLabelText("Public link to your post"));
  });

  it("sends focus back to the row's action after a submit succeeds", async () => {
    week();
    fireEvent.click(screen.getByRole("button", { name: "Submit your TikTok post" }));
    fireEvent.change(screen.getByLabelText("Public link to your post"), {
      target: { value: "https://www.tiktok.com/@adaobi/video/1" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit this entry" }));
    });
    expect(linkFields()).toHaveLength(0);
    expect(document.activeElement?.id).toBe("week-action-tiktok");
  });

  it("hands focus back to the pressed button when a submit fails, once it is live again", async () => {
    const answer = heldFetch();
    week();
    fireEvent.click(screen.getByRole("button", { name: "Submit your TikTok post" }));
    fireEvent.change(screen.getByLabelText("Public link to your post"), {
      target: { value: "https://www.tiktok.com/@adaobi/video/1" },
    });
    const submit = screen.getByRole("button", { name: "Submit this entry" });
    submit.focus();
    await act(async () => {
      fireEvent.click(submit);
    });
    dropFocusLikeChrome(submit);
    await act(async () => {
      answer(false);
    });
    expect(screen.getByRole("alert").textContent).toBe("No.");
    expect(document.activeElement).toBe(submit);
  });

  it("hands focus back to the pressed button when a take back fails, once it is live again", async () => {
    const answer = heldFetch();
    week();
    fireEvent.click(screen.getByRole("button", { name: "Take back your Instagram post for week 2" }));
    const yes = screen.getByRole("button", { name: "Yes, take it back" });
    yes.focus();
    await act(async () => {
      fireEvent.click(yes);
    });
    dropFocusLikeChrome(yes);
    await act(async () => {
      answer(false);
    });
    expect(document.getElementById("take-back-s-2b")).not.toBeNull();
    expect(document.activeElement).toBe(yes);
  });

  it("leaves focus where the creator went when a submit lands after they moved on", async () => {
    const answer = heldFetch();
    render(
      <>
        <Elsewhere />
        <WeekRows rows={ROWS} weekNo={2} challengeTitle="Show Them How It Moves" statusKnown canResend />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit your TikTok post" }));
    fireEvent.change(screen.getByLabelText("Public link to your post"), {
      target: { value: "https://www.tiktok.com/@adaobi/video/1" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit this entry" }));
    });
    const elsewhere = screen.getByTestId("elsewhere");
    elsewhere.focus();
    await act(async () => {
      answer(true);
    });
    expect(linkFields()).toHaveLength(0);
    expect(document.activeElement).toBe(elsewhere);
  });

  it("counts a started submission once per page view, however often a form reopens", () => {
    week();
    const type = (value: string) =>
      fireEvent.change(screen.getByLabelText("Public link to your post"), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Submit your X post" }));
    type("https://x.com/a");
    fireEvent.click(screen.getByRole("button", { name: "Cancel, X" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit your X post" }));
    type("https://x.com/b");
    // Another platform is the same creator starting, not a second start.
    fireEvent.click(screen.getByRole("button", { name: "Submit your TikTok post" }));
    type("https://www.tiktok.com/@adaobi/video/1");
    expect(vi.mocked(track).mock.calls).toEqual([[CAMPAIGN_EVENTS.submissionStarted]]);
  });

  it("holds the open row's Cancel and every other row while a submit is in flight", async () => {
    const answer = heldFetch();
    week();
    fireEvent.click(screen.getByRole("button", { name: "Submit your TikTok post" }));
    fireEvent.change(screen.getByLabelText("Public link to your post"), {
      target: { value: "https://www.tiktok.com/@adaobi/video/1" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit this entry" }));
    });
    const held = () => [
      screen.getByRole("button", { name: "Cancel, TikTok" }),
      screen.getByRole("button", { name: "Submit your X post" }),
      screen.getByRole("button", { name: "Take back your Instagram post for week 2" }),
    ];
    expect(held().map((b) => (b as HTMLButtonElement).disabled)).toEqual([true, true, true]);
    await act(async () => {
      answer(false);
    });
    // Refused: the form stays, and everything is live again.
    expect(linkFields()).toHaveLength(1);
    expect(held().map((b) => (b as HTMLButtonElement).disabled)).toEqual([false, false, false]);
  });

  it("says each row action opens something in place, and which", () => {
    week();
    const submit = screen.getByRole("button", { name: "Submit your X post" });
    expect(submit.getAttribute("aria-expanded")).toBe("false");
    expect(submit.getAttribute("aria-controls")).toBe("submit-panel-x");
    fireEvent.click(submit);
    const cancel = screen.getByRole("button", { name: "Cancel, X" });
    expect(cancel.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(cancel.getAttribute("aria-controls")!)?.tagName).toBe("FORM");

    const take = screen.getByRole("button", { name: "Take back your Instagram post for week 2" });
    expect(take.getAttribute("aria-expanded")).toBe("false");
    expect(take.getAttribute("aria-controls")).toBe("take-back-s-2b");
    fireEvent.click(take);
    const cancelTake = screen.getByRole("button", { name: "Cancel, Instagram" });
    expect(cancelTake.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(cancelTake.getAttribute("aria-controls")!)).not.toBeNull();
  });

  it("asks before taking an entry back, and sends nothing until Yes", async () => {
    week();
    fireEvent.click(screen.getByRole("button", { name: "Take back your Instagram post for week 2" }));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, take it back" }));
    });
    expect(sent()).toEqual({
      path: "/api/campaigns/monica/withdraw",
      body: { submissionId: "s-2b" },
    });
    expect(toast.success).toHaveBeenCalledWith("Taken back. That platform is free again this week.");
    expect(refresh).toHaveBeenCalledTimes(1);
    // Focus lands on the row's action, not on the body.
    expect(document.activeElement?.id).toBe("week-action-instagram");
  });

  it("promises no resend when one cannot be sent", async () => {
    week(ROWS, true, false);
    fireEvent.click(screen.getByRole("button", { name: "Take back your Instagram post for week 2" }));
    const question = document.getElementById("take-back-s-2b")!;
    expect(question.textContent).toContain("Taking this back removes it from review.");
    expect(question.textContent).not.toContain("frees");
    expect(question.textContent).not.toContain("is closed");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, take it back" }));
    });
    expect(toast.success).toHaveBeenCalledWith("Taken back.");
  });

  it("has a way back from Take back that sends nothing and returns focus", () => {
    week();
    fireEvent.click(screen.getByRole("button", { name: "Take back your Instagram post for week 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel, Instagram" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Take back your Instagram post for week 2" }),
    );
  });

  it("says Send again on a rejected entry, with the reviewer's reason under it", () => {
    week([
      {
        platform: "instagram",
        handle: "ada.obi",
        entry: { id: "s-2b", status: "rejected", url: "https://www.instagram.com/reel/p/", reviewNote: "Make it public." },
        canSubmit: true,
      },
    ]);
    const again = screen.getByRole("button", { name: "Send again, your Instagram post" });
    expect(again.textContent).toBe("Send again");
    // Label in name (WCAG 2.5.3): the words on the button start its name.
    expect(again.getAttribute("aria-label")!.startsWith(again.textContent!)).toBe(true);
    expect(screen.getByText("Needs a change")).toBeTruthy();
    // Wraps a pasted URL rather than clipping it at the card's edge.
    const note = screen.getByText("Make it public.");
    expect(note.className).toContain("[overflow-wrap:anywhere]");
    // Under its status, in the same column, and before the action that
    // answers it: below sm the action wraps under the text, after the note.
    expect(note.parentElement!.contains(screen.getByText("Needs a change"))).toBe(true);
    expect(note.parentElement!.contains(again)).toBe(false);
    expect(note.compareDocumentPosition(again) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("links a sent post by its mark, named for whose and where", () => {
    week();
    const mark = screen.getByRole("link", { name: "Your Instagram post for week 2 (opens in a new tab)" });
    expect(mark.getAttribute("href")).toBe("https://www.instagram.com/reel/p/");
    expect(mark.getAttribute("target")).toBe("_blank");
  });

  it("never claims Not sent when the entries could not be read", () => {
    week(ROWS, false);
    expect(document.body.textContent).not.toContain("Not sent");
    week(ROWS, true);
    expect(document.body.textContent).toContain("Not sent");
  });
});

describe("the account rows", () => {
  const accounts = (over: { paused?: boolean; when?: AddReadyWhen } = {}) =>
    render(
      <>
        <Elsewhere />
        <AccountRows
          handles={[
            { platform: "instagram", handle: "ada.obi" },
            { platform: "x", handle: "adaobi_writes" },
          ]}
          requests={[]}
          missing={["tiktok"]}
          {...over}
        />
      </>,
    );
  const hint = () => document.getElementById("add-tiktok-hint")?.textContent;

  /** Opens the X correction and fills it in, ready to send. */
  function fillCorrection() {
    fireEvent.click(
      screen.getByRole("button", { name: "Wrong username? Ask for a correction to your X account, @adaobi_writes" }),
    );
    fireEvent.change(screen.getByLabelText("The correct username"), { target: { value: "adaobi_writes2" } });
    fireEvent.change(screen.getByLabelText("What went wrong"), { target: { value: "Typo at signup" } });
  }

  /** Opens Add TikTok and answers Yes for @adaobi. */
  async function addTikTok() {
    fireEvent.click(screen.getByRole("button", { name: "Add TikTok" }));
    fireEvent.change(screen.getByLabelText("Your TikTok username"), { target: { value: "adaobi" } });
    fireEvent.click(screen.getByRole("button", { name: "Add TikTok" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, add it" }));
    });
  }

  it("says an added account is ready straight away only while a week is open", async () => {
    const { unmount } = accounts({ when: "open" });
    fireEvent.click(screen.getByRole("button", { name: "Add TikTok" }));
    expect(hint()).toBe("Your username or profile link; you can send posts from it straight away.");
    fireEvent.click(screen.getByRole("button", { name: "Cancel adding TikTok" }));
    await addTikTok();
    expect(toast.success).toHaveBeenCalledWith("TikTok added. You can send a post from it now.");
    unmount();

    accounts({ when: "next" });
    fireEvent.click(screen.getByRole("button", { name: "Add TikTok" }));
    expect(hint()).toBe("Your username or profile link; it will be ready for the next challenge.");
    fireEvent.click(screen.getByRole("button", { name: "Cancel adding TikTok" }));
    await addTikTok();
    expect(toast.success).toHaveBeenLastCalledWith("TikTok added. It is ready for the next challenge.");
    // Success returns focus to the row's action slot.
    expect(document.activeElement?.id).toBe("account-action-tiktok");
  });

  it("promises no time when no stage remains, when the week could not be read, or when not told", async () => {
    for (const when of ["over", "unknown", undefined] as const) {
      vi.mocked(toast.success).mockClear();
      const { unmount } = accounts(when ? { when } : {});
      fireEvent.click(screen.getByRole("button", { name: "Add TikTok" }));
      expect(hint()).toBe("Your username or profile link.");
      fireEvent.click(screen.getByRole("button", { name: "Cancel adding TikTok" }));
      await addTikTok();
      expect(toast.success).toHaveBeenCalledWith("TikTok added.");
      unmount();
    }
  });

  it("keeps the paused wording when paused, whatever the week", async () => {
    for (const when of ["open", "next", "over", "unknown"] as const) {
      vi.mocked(toast.success).mockClear();
      const { unmount } = accounts({ paused: true, when });
      fireEvent.click(screen.getByRole("button", { name: "Add TikTok" }));
      expect(hint()).toBe("Your username or profile link; it will be ready for when submissions reopen.");
      fireEvent.click(screen.getByRole("button", { name: "Cancel adding TikTok" }));
      await addTikTok();
      expect(toast.success).toHaveBeenCalledWith("TikTok added. It is ready for when submissions reopen.");
      unmount();
    }
  });

  it("says the pencil and Add open something in place, and which", () => {
    accounts();
    const pencil = screen.getByRole("button", {
      name: "Wrong username? Ask for a correction to your X account, @adaobi_writes",
    });
    expect(pencil.getAttribute("aria-expanded")).toBe("false");
    expect(pencil.getAttribute("aria-controls")).toBe("handle-fix-x");
    fireEvent.click(pencil);
    const cancel = screen.getByRole("button", { name: "Cancel the X correction" });
    expect(cancel.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("handle-fix-x")).not.toBeNull();

    const add = screen.getByRole("button", { name: "Add TikTok" });
    expect(add.getAttribute("aria-expanded")).toBe("false");
    expect(add.getAttribute("aria-controls")).toBe("add-panel-tiktok");
    fireEvent.click(add);
    const cancelAdd = screen.getByRole("button", { name: "Cancel adding TikTok" });
    expect(cancelAdd.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("add-panel-tiktok")).not.toBeNull();
  });

  it("keeps one form open: a correction and an add never sit open together", () => {
    accounts();
    fireEvent.click(
      screen.getByRole("button", { name: "Wrong username? Ask for a correction to your X account, @adaobi_writes" }),
    );
    expect(screen.getByLabelText("The correct username")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add TikTok" }));
    expect(screen.queryByLabelText("The correct username")).toBeNull();
    expect(screen.getByLabelText("Your TikTok username")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Wrong username? Ask for a correction to your Instagram account, @ada.obi" }),
    );
    expect(screen.queryByLabelText("Your TikTok username")).toBeNull();
    expect(screen.getAllByLabelText("The correct username")).toHaveLength(1);
  });

  it("lists the accounts X, Instagram, TikTok, whatever order they were read in", () => {
    accounts();
    const text = document.body.textContent ?? "";
    expect(text.indexOf("@adaobi_writes")).toBeLessThan(text.indexOf("@ada.obi"));
    expect(text.indexOf("@ada.obi")).toBeLessThan(text.indexOf("Not added"));
  });

  it("files a correction with the same request as before", async () => {
    accounts();
    fillCorrection();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send the request" }));
    });
    expect(sent()).toEqual({
      path: "/api/campaigns/monica/request-handle-fix",
      body: { platform: "x", handle: "adaobi_writes2", reason: "Typo at signup" },
    });
    expect(document.activeElement?.id).toBe("account-action-x");
  });

  it("hands focus back to Send the request when a correction is refused, once it is live again", async () => {
    const answer = heldFetch();
    accounts();
    fillCorrection();
    const send = screen.getByRole("button", { name: "Send the request" });
    send.focus();
    await act(async () => {
      fireEvent.click(send);
    });
    dropFocusLikeChrome(send);
    await act(async () => {
      answer(false);
    });
    expect(screen.getByLabelText("The correct username")).toBeTruthy();
    expect(document.activeElement).toBe(send);
  });

  it("hands focus back to Add when an add is refused, once it is live again", async () => {
    const answer = heldFetch();
    accounts();
    fireEvent.click(screen.getByRole("button", { name: "Add TikTok" }));
    fireEvent.change(screen.getByLabelText("Your TikTok username"), { target: { value: "adaobi" } });
    fireEvent.click(screen.getByRole("button", { name: "Add TikTok" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, add it" }));
    });
    // Yes has gone with the question, taking focus with it; Add, disabled,
    // carries the request from here.
    expect((screen.getByRole("button", { name: "Adding…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.activeElement).toBe(document.body);
    await act(async () => {
      answer(false);
    });
    expect(screen.getByLabelText("Your TikTok username")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add TikTok" }));
  });

  it("holds Cancel and every other row while a request is in flight", async () => {
    const answer = heldFetch();
    accounts();
    fillCorrection();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send the request" }));
    });
    const held = () =>
      [
        screen.getByRole("button", { name: "Cancel the X correction" }),
        screen.getByRole("button", {
          name: "Wrong username? Ask for a correction to your Instagram account, @ada.obi",
        }),
        screen.getByRole("button", { name: "Add TikTok" }),
      ].map((b) => (b as HTMLButtonElement).disabled);
    expect(held()).toEqual([true, true, true]);
    await act(async () => {
      answer(false);
    });
    // Refused: the form stays, and everything is live again.
    expect(screen.getByLabelText("The correct username")).toBeTruthy();
    expect(held()).toEqual([false, false, false]);
  });

  it("leaves focus where the creator went when a correction lands after they moved on", async () => {
    const answer = heldFetch();
    accounts();
    fillCorrection();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send the request" }));
    });
    const elsewhere = screen.getByTestId("elsewhere");
    elsewhere.focus();
    await act(async () => {
      answer(true);
    });
    expect(screen.queryByLabelText("The correct username")).toBeNull();
    expect(document.activeElement).toBe(elsewhere);
  });
});

describe("the earlier weeks", () => {
  const W1_PENDING: EntryRow = {
    id: "s-1x",
    weekNo: 1,
    challengeTitle: "Make Them Curious",
    platform: "x",
    status: "pending",
    url: "https://x.com/adaobi_writes/status/1",
    reviewNote: null,
  };

  it("says a closed week's entry cannot be replaced, toasts no promise, and returns focus", async () => {
    render(<EntryHistory entries={[W1_PENDING]} openWeekKnown />);
    const take = screen.getByRole("button", { name: "Take back your X post for week 1" });
    expect(take.getAttribute("aria-expanded")).toBe("false");
    expect(take.getAttribute("aria-controls")).toBe("take-back-s-1x");
    fireEvent.click(take);
    expect(screen.getByRole("button", { name: "Cancel" }).getAttribute("aria-expanded")).toBe("true");
    const question = document.getElementById("take-back-s-1x")!;
    expect(question.textContent).toContain(
      "Taking this back removes it from review. Week 1 is closed, so it cannot be replaced.",
    );
    expect(question.textContent).not.toContain("frees");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, take it back" }));
    });
    expect(toast.success).toHaveBeenCalledWith("Taken back.");
    expect(document.activeElement?.id).toBe("entry-action-s-1x");
  });

  it("does not call a week closed when the open week could not be read", () => {
    render(<EntryHistory entries={[{ ...W1_PENDING, weekNo: 2 }]} openWeekKnown={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Take back your X post for week 2" }));
    const question = document.getElementById("take-back-s-1x")!;
    expect(question.textContent).toContain("Taking this back removes it from review.");
    expect(question.textContent).not.toContain("is closed");
    expect(question.textContent).not.toContain("frees");
  });

  const W1_IG: EntryRow = { ...W1_PENDING, id: "s-1y", platform: "instagram", url: "https://www.instagram.com/p/1/" };

  it("holds Cancel and every other row while a take back is in flight, and closes only its own", async () => {
    const answer = heldFetch();
    render(
      <>
        <Elsewhere />
        <EntryHistory entries={[W1_PENDING, W1_IG]} openWeekKnown />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Take back your X post for week 1" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, take it back" }));
    });
    const held = () =>
      [
        screen.getByRole("button", { name: "Cancel" }),
        screen.getByRole("button", { name: "Take back your Instagram post for week 1" }),
      ].map((b) => (b as HTMLButtonElement).disabled);
    expect(held()).toEqual([true, true]);
    // The creator moves on while it runs; the success must not pull them back.
    const elsewhere = screen.getByTestId("elsewhere");
    elsewhere.focus();
    await act(async () => {
      answer(true);
    });
    expect(document.getElementById("take-back-s-1x")).toBeNull();
    expect(document.activeElement).toBe(elsewhere);
    expect((screen.getByRole("button", { name: "Take back your Instagram post for week 1" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("hands focus back to the pressed button when a take back fails, once it is live again", async () => {
    const answer = heldFetch();
    render(<EntryHistory entries={[W1_PENDING]} openWeekKnown />);
    fireEvent.click(screen.getByRole("button", { name: "Take back your X post for week 1" }));
    const notMe = screen.getByRole("button", { name: "I did not send this" });
    notMe.focus();
    await act(async () => {
      fireEvent.click(notMe);
    });
    dropFocusLikeChrome(notMe);
    await act(async () => {
      answer(false);
    });
    expect(document.getElementById("take-back-s-1x")).not.toBeNull();
    expect(document.activeElement).toBe(notMe);
  });

  it("wraps a long reviewer note instead of clipping it", () => {
    render(
      <EntryHistory
        entries={[{ ...W1_PENDING, status: "rejected", reviewNote: "See https://x.com/a/b/c" }]}
        openWeekKnown
      />,
    );
    expect(screen.getByText("See https://x.com/a/b/c").className).toContain("[overflow-wrap:anywhere]");
  });
});

/* ---- The whole page, from the fixtures page.tsx would hand it ------------ */

const at = (iso: string) => new Date(iso);
const ENDS = at("2026-10-03T12:00:00+01:00");
const sub = (
  id: string,
  weekNo: number,
  platform: string,
  status: string,
  reviewNote: string | null = null,
): CreatorSubmission => ({
  id,
  weekNo,
  platform,
  status,
  url: `https://example.test/${id}`,
  submittedAt: at("2026-09-20T09:00:00+01:00"),
  reviewNote,
  challengeTitle: weekNo === 1 ? "Make Them Curious" : "Show Them How It Moves",
});

function props(over: Partial<MeDashboardProps> = {}): MeDashboardProps {
  const mine = over.mine ?? [
    sub("s-2a", 2, "x", "approved"),
    sub("s-1c", 1, "tiktok", "rejected", "It was set to Friends only."),
    sub("s-1a", 1, "x", "approved"),
  ];
  const thisWeek = mine.filter((s) => s.weekNo === 2);
  return {
    creator: { pointsTotal: 335, approvedEntries: 2, referralCode: "ADAOBI7K" },
    firstName: "Ada",
    joined: "18 September",
    rank: 14,
    status: "active",
    challenge: {
      id: "ch-2",
      title: "Show Them How It Moves",
      description: "One real money moment.",
      weekNo: 2,
      endsAt: ENDS,
    },
    platforms: ["x", "instagram", "tiktok"],
    mine,
    history: [
      { id: "p-1", source: "challenge_entry", points: 100, note: null, weekNo: 1, at: at("2026-09-21T09:30:00+01:00") },
    ],
    handles: [
      { platform: "x", handle: "adaobi_writes" },
      { platform: "instagram", handle: "ada.obi" },
      { platform: "tiktok", handle: "adaobi" },
    ],
    failed: { challenge: false, platforms: false, submissions: false, history: false, handles: false },
    pause: { paused: false, reason: null },
    handleRequests: [],
    usedThisWeek: ["x"],
    thisWeek,
    rejectedThisWeek: [],
    stillToSubmit: ["instagram", "tiktok"],
    referralLink: "https://blockfestafrica.com/campaigns/monica-money-story/join?ref=ADAOBI7K",
    ...over,
  };
}

describe("the creator page", () => {
  it("says when the week closes with the ballot's formatter, not a 0:00 pm", () => {
    render(<MeDashboard {...props()} />);
    const week = screen.getByRole("region", { name: "Show Them How It Moves" });
    const time = week.querySelector("time");
    expect(time?.getAttribute("dateTime")).toBe(ENDS.toISOString());
    expect(time?.textContent).toBe(closingAt(ENDS));
    expect(week.textContent).toContain(`Closes ${closingAt(ENDS)}, Lagos time`);
    expect(document.body.textContent).not.toMatch(/0:00\s*pm/i);
  });

  it("puts the points total in the points header, and not in the identity line", () => {
    render(<MeDashboard {...props()} />);
    const points = screen.getByRole("region", { name: "Your points" });
    const header = points.firstElementChild as HTMLElement;
    expect(header.textContent).toMatch(/Your points\s*335 total/);
    expect(screen.getByText(/2 approved · joined 18 September/).textContent).not.toContain("335");
  });

  it("shows a zero total with a line saying what will be listed, rather than hiding the card", () => {
    render(<MeDashboard {...props({ history: [], creator: { pointsTotal: 0, approvedEntries: 0, referralCode: "X" } })} />);
    const points = screen.getByRole("region", { name: "Your points" });
    expect(points.textContent).toContain("0 total");
    expect(points.textContent).toContain("Every point you earn is listed here, with its reason.");
  });

  it("lists earlier weeks as platform-mark links with accessible names, the open week in its own card", () => {
    render(<MeDashboard {...props()} />);
    const earlier = screen.getByRole("region", { name: "Earlier weeks" });
    expect(earlier.textContent).toContain("2 posts");
    expect(earlier.textContent).toContain("Week 1 · Make Them Curious");
    const mark = within(earlier).getByRole("link", { name: "Your TikTok post for week 1 (opens in a new tab)" });
    expect(mark.getAttribute("href")).toBe("https://example.test/s-1c");
    expect(within(earlier).queryByRole("link", { name: /week 2/ })).toBeNull();
    // No raw URL printed as text any more.
    expect(earlier.textContent).not.toContain("https://");
    const week = screen.getByRole("region", { name: "Show Them How It Moves" });
    expect(within(week).getByRole("link", { name: "Your X post for week 2 (opens in a new tab)" })).toBeTruthy();
  });

  it("hides the entries card while a week is open and nothing came before it", () => {
    render(<MeDashboard {...props({ mine: [sub("s-2a", 2, "x", "approved")] })} />);
    expect(screen.queryByRole("region", { name: "Earlier weeks" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Your entries" })).toBeNull();
  });

  it("offers nothing to send or add while removed, and says so first", () => {
    const twoAccounts = {
      platforms: ["x", "instagram"],
      handles: [
        { platform: "x", handle: "adaobi_writes" },
        { platform: "instagram", handle: "ada.obi" },
      ],
      stillToSubmit: ["instagram"],
    };
    const { unmount } = render(<MeDashboard {...props(twoAccounts)} />);
    // The control under test exists while active, so its absence below means something.
    expect(screen.getByRole("button", { name: "Add TikTok" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit your Instagram post" })).toBeTruthy();
    unmount();
    render(<MeDashboard {...props({ ...twoAccounts, status: "disqualified" })} />);
    expect(document.body.textContent).toContain("Your place in the campaign has been removed");
    expect(screen.queryByRole("button", { name: /^Submit your/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add TikTok" })).toBeNull();
  });

  it("offers nothing to send while paused", () => {
    render(<MeDashboard {...props({ pause: { paused: true, reason: null } })} />);
    expect(document.body.textContent).toContain("Submissions are paused");
    expect(screen.queryByRole("button", { name: /^Submit your/ })).toBeNull();
  });

  it("keeps sign-out behind the asking form, with its full name", () => {
    render(<MeDashboard {...props()} />);
    const button = screen.getByRole("button", { name: "Sign out on this device" });
    expect(button.textContent).toBe("Sign out");
    expect(button.getAttribute("type")).toBe("submit");
  });

  it("puts Sign out before the help in the tab order, clear of the summary at every width", () => {
    render(<MeDashboard {...props()} />);
    const button = screen.getByRole("button", { name: "Sign out on this device" });
    const summary = screen.getByText("Keeping your way back in").closest("summary")!;
    expect(button.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(summary.className).toMatch(/\bpr-32\b/);
    expect(summary.className).not.toMatch(/\bsm:px-/);
  });

  it("promises no resend from the week's rows while removed, paused, or without the accounts", async () => {
    const pending = { mine: [sub("s-2b", 2, "instagram", "pending")], stillToSubmit: ["x", "tiktok"] };
    const states: Partial<MeDashboardProps>[] = [
      { status: "disqualified" },
      { pause: { paused: true, reason: null } },
      // The accounts read failed: nothing can be sent, so nothing is promised.
      {
        platforms: [],
        stillToSubmit: [],
        failed: { challenge: false, platforms: true, submissions: false, history: false, handles: false },
      },
    ];
    for (const over of states) {
      vi.mocked(toast.success).mockClear();
      const { unmount } = render(<MeDashboard {...props({ ...pending, ...over })} />);
      fireEvent.click(screen.getByRole("button", { name: "Take back your Instagram post for week 2" }));
      const question = document.getElementById("take-back-s-2b")!;
      expect(question.textContent).toContain("Taking this back removes it from review.");
      expect(question.textContent).not.toContain("frees");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Yes, take it back" }));
      });
      expect(toast.success).toHaveBeenCalledWith("Taken back.");
      unmount();
    }
  });

  it("names the accounts rule, the failed-accounts way back and the Winners chip truthfully", () => {
    const { unmount } = render(<MeDashboard {...props()} />);
    const accounts = screen.getByRole("region", { name: "Your accounts" });
    expect(accounts.firstElementChild?.textContent).toContain("Entries count only from accounts added here");
    expect(screen.getByRole("link", { name: "Winners" }).getAttribute("href")).toBe(monicaRoutes.winners);
    unmount();
    render(
      <MeDashboard
        {...props({ failed: { challenge: false, platforms: true, submissions: false, history: false, handles: false } })}
      />,
    );
    expect(document.body.textContent).toContain(
      "refresh in a moment and your platforms will be here to send from.",
    );
    expect(document.body.textContent).not.toContain("the form will be here");
  });

  it("wraps a long ledger note instead of clipping it", () => {
    const note = "See https://x.com/monicanigeria/status/1972318840126554321";
    render(
      <MeDashboard
        {...props({
          history: [{ id: "p-9", source: "featured_monica", points: 50, note, weekNo: null, at: at("2026-09-26T12:00:00+01:00") }],
        })}
      />,
    );
    expect(screen.getByText(new RegExp(note.replace(/[.?/]/g, "\\$&"))).className).toContain(
      "[overflow-wrap:anywhere]",
    );
  });

  const oneAccount = { handles: [{ platform: "x", handle: "adaobi_writes" }] };
  const addHint = () => {
    fireEvent.click(screen.getByRole("button", { name: "Add TikTok" }));
    return document.getElementById("add-tiktok-hint")?.textContent;
  };
  /** Answers Yes for @adaobi in the open Add TikTok form. */
  async function confirmAdd() {
    fireEvent.change(screen.getByLabelText("Your TikTok username"), { target: { value: "adaobi" } });
    fireEvent.click(screen.getByRole("button", { name: "Add TikTok" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, add it" }));
    });
  }

  it("offers an added account straight away while a week is open", () => {
    render(<MeDashboard {...props(oneAccount)} />);
    expect(addHint()).toBe("Your username or profile link; you can send posts from it straight away.");
  });

  it("offers an added account for the next challenge when no week is open but one remains", () => {
    clockAt("2026-09-27T12:00:00+01:00");
    render(<MeDashboard {...props({ ...oneAccount, challenge: null })} />);
    expect(addHint()).toBe("Your username or profile link; it will be ready for the next challenge.");
  });

  it("promises no next challenge once the last one has closed (17 October, 12:00)", async () => {
    clockAt("2026-10-17T12:00:00+01:00");
    render(<MeDashboard {...props({ ...oneAccount, challenge: null })} />);
    expect(addHint()).toBe("Your username or profile link.");
    await confirmAdd();
    expect(toast.success).toHaveBeenCalledWith("TikTok added.");
  });

  it("promises nothing about when when the challenge could not be read", async () => {
    // A stage remains, so only the failed read keeps this from saying "next".
    clockAt("2026-09-27T12:00:00+01:00");
    render(
      <MeDashboard
        {...props({
          ...oneAccount,
          challenge: null,
          failed: { challenge: true, platforms: false, submissions: false, history: false, handles: false },
        })}
      />,
    );
    expect(addHint()).toBe("Your username or profile link.");
    await confirmAdd();
    expect(toast.success).toHaveBeenCalledWith("TikTok added.");
  });

  it("never calls the open week closed when the challenge could not be read", () => {
    const pendingW2 = { mine: [sub("s-2b", 2, "instagram", "pending")] };
    const ask = () => {
      fireEvent.click(screen.getByRole("button", { name: "Take back your Instagram post for week 2" }));
      return document.getElementById("take-back-s-2b")!.textContent;
    };
    // Read, and none open: every week listed has closed.
    clockAt("2026-09-27T12:00:00+01:00");
    const { unmount } = render(<MeDashboard {...props({ ...pendingW2, challenge: null })} />);
    expect(ask()).toContain("Week 2 is closed, so it cannot be replaced.");
    unmount();
    // Not read: week 2 may be the open one, listed here only for want of the read.
    render(
      <MeDashboard
        {...props({
          ...pendingW2,
          challenge: null,
          failed: { challenge: true, platforms: false, submissions: false, history: false, handles: false },
        })}
      />,
    );
    const question = ask();
    expect(question).toContain("Taking this back removes it from review.");
    expect(question).not.toContain("is closed");
  });
});

describe("the week card when no challenge is open", () => {
  const closedCard = () => {
    render(<MeDashboard {...props({ challenge: null })} />);
    const card = screen.getByRole("region", { name: "No challenge is open" });
    const header = card.firstElementChild as HTMLElement;
    return { card, status: header.children[1] as HTMLElement | undefined };
  };

  it("names the next stage's date while its window is still ahead", () => {
    clockAt("2026-09-27T12:00:00+01:00");
    const { card, status } = closedCard();
    expect(status?.textContent).toBe("The next opens Monday 28 September");
    expect(card.textContent).toContain("It appears here when it opens, with somewhere to paste your link.");
  });

  it("promises no date once the window has started but its challenge is not live", () => {
    // Stage 2's window opened at midnight; the console has not switched it on yet.
    clockAt("2026-09-28T09:00:00+01:00");
    const { card, status } = closedCard();
    expect(status?.textContent).toBe("Week 2 opens soon");
    expect(status?.className).toContain("text-ink-3");
    expect(status?.outerHTML).not.toContain("gold");
    // Not the stage after it, a week out.
    expect(card.textContent).not.toContain("The next opens");
    expect(card.textContent).not.toMatch(/October|September/);
  });

  it("says the challenges are over after the last one closes, with no status", () => {
    clockAt("2026-10-17T12:30:00+01:00");
    const { card, status } = closedCard();
    expect(status).toBeUndefined();
    expect(card.textContent).toContain("All four challenges have closed.");
    expect(card.textContent).not.toContain("It appears here when it opens");
  });

  it("draws the focus ring inside the full-bleed link, where the card cannot clip it", () => {
    const { card } = closedCard();
    const link = within(card).getByRole("link", { name: "See all four challenges" });
    expect(link.className).toContain("focus-visible:outline-offset-[-4px]");
  });
});
