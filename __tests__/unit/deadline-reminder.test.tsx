/**
 * The deadline reminder's words and its place in the console.
 *
 * The owner asked for a button, pressed by a person, that tells creators a
 * stage closes in the next day, visible on the admin side. These pin how the
 * close is said, what the email says, and the live week's row: where things
 * stand, the button, and the card turning gold on the day it is due.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closesWhen } from "@/lib/format";
import { deadlineReminderEmail } from "@/lib/email/templates";
import { ChallengeEditor, type EditableChallenge } from "@/components/admin/challenge-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, sent: 3, failed: 0 }) }));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("how the close is said", () => {
  // Saturday 10 October 2026, 12:00 Lagos.
  const close = "2026-10-10T11:00:00.000Z";
  it("counts days on the Lagos calendar", () => {
    expect(closesWhen(close, new Date("2026-10-10T07:00:00+01:00"))).toBe("today at 12:00");
    expect(closesWhen(close, new Date("2026-10-09T23:30:00+01:00"))).toBe("tomorrow at 12:00");
    // 00:30 Lagos on Saturday is still Friday night in UTC, and it is today in Lagos.
    expect(closesWhen(close, new Date("2026-10-10T00:30:00+01:00"))).toBe("today at 12:00");
    expect(closesWhen(close, new Date("2026-10-07T12:00:00+01:00"))).toBe("on Saturday at 12:00");
  });
});

describe("the reminder email", () => {
  const email = deadlineReminderEmail({
    to: "ada@e.com",
    fullName: "Ada & Co Obi",
    weekNo: 3,
    title: "Money <Moves>",
    closesWhen: "tomorrow at 12:00",
    closesAtLagos: "Saturday, 10 October at 12:00",
    pageUrl: "https://blockfestafrica.com/campaigns/monica-money-story/me",
  });

  it("says which stage, when it closes, and that their entry is not in", () => {
    expect(email.subject).toBe("Stage 3 closes tomorrow at 12:00");
    expect(email.text).toContain("your entry is not in yet");
    expect(email.text).toContain("Saturday, 10 October at 12:00, Lagos time");
    expect(email.text).toContain("sent back for a change");
    expect(email.text).toContain("https://blockfestafrica.com/campaigns/monica-money-story/me");
  });

  it("escapes what a creator or the console typed, once", () => {
    expect(email.html).toContain("Money &lt;Moves&gt;");
    expect(email.html).not.toContain("&amp;amp;");
    expect(email.html).not.toContain("<Moves>");
  });
});

const live = (over: Partial<EditableChallenge> = {}): EditableChallenge => ({
  id: "c3",
  weekNo: 3,
  title: "Money Moves",
  description: "Brief",
  question: null,
  focus: null,
  skills: null,
  basePoints: 100,
  status: "active",
  startsAt: "2026-10-05T00:00:00+01:00",
  endsAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
  readonly_: false,
  reminder: { waiting: 3, active: 10, sent: null },
  ...over,
});

const card = () => document.getElementById("stages")!;

describe("the live week's row", () => {
  it("shows where things stand and the button, without opening Edit", () => {
    render(<ChallengeEditor challenges={[live()]} />);
    expect(screen.getByText("Deadline reminder")).toBeTruthy();
    expect(screen.getByText(/3 of 10 active creators have nothing in yet/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remind them" })).toBeTruthy();
    // Nothing else of the week's form is open.
    expect(screen.queryByLabelText("Title")).toBeNull();
  });

  it("asks first, then sends to the route for that week", async () => {
    render(<ChallengeEditor challenges={[live()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remind them" }));
    expect(screen.getByText(/Email the 3 creators with nothing in that week 3 closes tomorrow|today/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, remind 3" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/admin/remind-challenge");
    expect(JSON.parse(String(init.body))).toEqual({ challengeId: "c3" });
  });

  it("turns the card gold on the day it is due, and not once it is sent", () => {
    const { unmount } = render(<ChallengeEditor challenges={[live()]} />);
    expect(card().className).toMatch(/border-l-brand-gold/);
    unmount();
    render(
      <ChallengeEditor
        challenges={[live({ reminder: { waiting: 3, active: 10, sent: { at: "2026-10-09T10:00:00.000Z", sent: 3, failed: 0, finished: true } } })]}
      />,
    );
    expect(card().className).not.toMatch(/border-l-brand-gold/);
  });

  it("is not due days before the close", () => {
    render(
      <ChallengeEditor
        challenges={[live({ endsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString() })]}
      />,
    );
    expect(card().className).not.toMatch(/border-l-brand-gold/);
    // The button is still there; it is just not demanding attention yet.
    expect(screen.getByRole("button", { name: "Remind them" })).toBeTruthy();
  });

  it("says it was sent, and offers no second send", () => {
    render(
      <ChallengeEditor
        challenges={[live({ reminder: { waiting: 1, active: 10, sent: { at: "2026-10-09T10:00:00.000Z", sent: 3, failed: 1, finished: true } } })]}
      />,
    );
    const row = screen.getByText("Deadline reminder").closest("div")!.parentElement!;
    expect(within(row).getByText(/Sent .* to 3 creators; 1 did not send\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remind them" })).toBeNull();
  });

  it("says how far an unfinished send got, without claiming it stopped", () => {
    render(
      <ChallengeEditor
        challenges={[live({ reminder: { waiting: 5, active: 10, sent: { at: "2026-10-09T10:00:00.000Z", sent: 40, failed: 0, finished: false } } })]}
      />,
    );
    expect(screen.getByText(/40 sent so far\. It may still be sending, or it stopped part way; either way it will not send again\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remind them" })).toBeNull();
  });

  it("while it sends, says Working only on its own button, and holds the others", async () => {
    fetchMock.mockImplementationOnce(() => new Promise(() => {}) as never);
    render(<ChallengeEditor challenges={[live()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remind them" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, remind 3" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const save = screen.getByRole("button", { name: /Save week 3/ }) as HTMLButtonElement;
    expect(save.textContent).not.toContain("Saving");
    expect(save.disabled).toBe(true);
  });

  it("says when everyone is in, with no button", () => {
    render(<ChallengeEditor challenges={[live({ reminder: { waiting: 0, active: 10, sent: null } })]} />);
    expect(screen.getByText(/Every active creator has an entry in/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remind them" })).toBeNull();
  });

  it("does not appear on a week without reminder data (drafts, closed weeks)", () => {
    render(<ChallengeEditor challenges={[live({ reminder: undefined, status: "draft" })]} />);
    expect(screen.queryByText("Deadline reminder")).toBeNull();
  });
});
