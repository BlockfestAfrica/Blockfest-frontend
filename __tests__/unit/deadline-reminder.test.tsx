/**
 * The deadline reminders' words and their place in the console.
 *
 * The owner asked for a button, pressed by a person, that tells creators a
 * stage closes in the next day. Then a creator read "closes today at 12:00"
 * as midnight and missed stage 2, so deadlines now say noon, the emails say
 * "midday, not midnight", and a stage gets two reminders: one the evening
 * before, and a last call on the morning.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closesWhen, closingAt } from "@/lib/format";
import { challengeLiveEmail, deadlineReminderEmail } from "@/lib/email/templates";
import { nextReminder, REMINDER_GAP_MS, type ReminderSent } from "@/lib/reminder-rules";
import { ChallengeEditor, type EditableChallenge } from "@/components/admin/challenge-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ ok: true, sent: 3, failed: 0, number: 1 }),
}));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("how a deadline is said", () => {
  // Saturday 10 October 2026, 12:00 Lagos.
  const close = "2026-10-10T11:00:00.000Z";

  it("says noon, never a bare 12:00", () => {
    expect(closingAt(close)).toMatch(/12:00 noon$/);
    expect(closesWhen(close, new Date("2026-10-10T07:00:00+01:00"))).toBe("today at 12:00 noon");
  });

  it("leaves other times alone", () => {
    expect(closingAt("2026-10-06T20:00:00.000Z")).not.toMatch(/noon/);
    expect(closingAt("2026-09-24T22:59:59.000Z")).not.toMatch(/noon/);
  });

  it("counts days on the Lagos calendar", () => {
    expect(closesWhen(close, new Date("2026-10-09T23:30:00+01:00"))).toBe("tomorrow at 12:00 noon");
    // 00:30 Lagos on Saturday is still Friday night in UTC, and it is today in Lagos.
    expect(closesWhen(close, new Date("2026-10-10T00:30:00+01:00"))).toBe("today at 12:00 noon");
    expect(closesWhen(close, new Date("2026-10-07T12:00:00+01:00"))).toBe("on Saturday at 12:00 noon");
  });
});

describe("the emails", () => {
  const reminder = (lastCall = false) =>
    deadlineReminderEmail({
      to: "ada@e.com",
      fullName: "Ada & Co Obi",
      weekNo: 3,
      title: "Money <Moves>",
      closesWhen: "tomorrow at 12:00 noon",
      closesAtLagos: "Saturday, 10 October at 12:00 noon",
      pageUrl: "https://blockfestafrica.com/campaigns/monica-money-story/me",
      lastCall,
    });

  it("the reminder says which stage, when, and that noon is midday", () => {
    const email = reminder();
    expect(email.subject).toBe("Stage 3 closes tomorrow at 12:00 noon");
    expect(email.text).toContain("your entry is not in yet");
    expect(email.text).toContain("Saturday, 10 October at 12:00 noon, Lagos time");
    expect(email.text).toContain("That is midday, not midnight");
    expect(email.html).toContain("That is midday, not midnight");
    expect(email.text).toContain("sent back for a change");
  });

  it("the second reminder is a last call", () => {
    const email = reminder(true);
    expect(email.subject).toBe("Last call: stage 3 closes tomorrow at 12:00 noon");
    expect(email.html).toContain("Last call: stage 3 closes");
  });

  it("escapes what a creator or the console typed, once", () => {
    const email = reminder();
    expect(email.html).toContain("Money &lt;Moves&gt;");
    expect(email.html).not.toContain("&amp;amp;");
    expect(email.html).not.toContain("<Moves>");
  });

  it("the stage announcement says noon is midday, and that stage 1 was different", () => {
    const email = challengeLiveEmail({
      to: "ada@e.com",
      fullName: "Ada Obi",
      weekNo: 3,
      title: "T",
      question: null,
      brief: "B",
      basePoints: 100,
      closesAtLagos: "Saturday, 10 October at 12:00 noon",
      pageUrl: "https://blockfestafrica.com/campaigns/monica-money-story/me",
    });
    expect(email.text).toContain("That is midday, not midnight: stage 1 closed at night, but stages 2 to 4 close at noon.");
    expect(email.html).toContain("That is midday, not midnight");
  });

  it("says nothing about midday for a close that is not at noon", () => {
    const email = challengeLiveEmail({
      to: "ada@e.com",
      fullName: "Ada Obi",
      weekNo: 1,
      title: "T",
      question: null,
      brief: "B",
      basePoints: 100,
      closesAtLagos: "Thursday, 24 September at 23:59",
      pageUrl: "https://blockfestafrica.com/campaigns/monica-money-story/me",
    });
    expect(email.text).not.toContain("midday");
  });
});

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
const sentAt = (number: number, at: string, over: Partial<ReminderSent> = {}): ReminderSent => ({
  number,
  at,
  sent: 3,
  failed: 0,
  finished: true,
  ...over,
});

describe("when the next reminder may go", () => {
  it("allows two, the second six hours after the first, and only once the first finished", () => {
    const now = new Date("2026-10-10T08:00:00+01:00").getTime();
    const before = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();
    expect(nextReminder([], now)).toEqual({ ok: true, number: 1 });
    expect(nextReminder([sentAt(1, before(7))], now)).toEqual({ ok: true, number: 2 });
    const soon = nextReminder([sentAt(1, before(1))], now);
    expect(soon).toMatchObject({ ok: false, reason: "too-soon" });
    expect((soon as { at: number }).at).toBe(now - 60 * 60 * 1000 + REMINDER_GAP_MS);
    expect(nextReminder([sentAt(1, before(7), { finished: false })], now)).toMatchObject({ ok: false, reason: "unfinished" });
    expect(nextReminder([sentAt(1, before(20)), sentAt(2, before(8))], now)).toMatchObject({ ok: false, reason: "all-sent" });
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
  reminder: { waiting: 3, active: 10, sent: [] },
  ...over,
});

const card = () => document.getElementById("stages")!;
const row = () => screen.getByText("Deadline reminders").parentElement!;

describe("the live week's row", () => {
  it("shows where things stand and the button, without opening Edit", () => {
    render(<ChallengeEditor challenges={[live()]} />);
    expect(screen.getByText(/3 of 10 active creators have nothing in yet/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remind them" })).toBeTruthy();
    expect(screen.queryByLabelText("Title")).toBeNull();
  });

  it("asks first, then sends to the route for that week", async () => {
    render(<ChallengeEditor challenges={[live()]} />);
    fireEvent.click(screen.getByRole("button", { name: "Remind them" }));
    expect(screen.getByText(/Email the 3 creators with nothing in that week 3 closes (today|tomorrow) at /)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, remind 3" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/admin/remind-challenge");
    expect(JSON.parse(String(init.body))).toEqual({ challengeId: "c3" });
  });

  it("offers the last call six hours after the first, to whoever still has nothing in", () => {
    render(<ChallengeEditor challenges={[live({ reminder: { waiting: 2, active: 10, sent: [sentAt(1, hoursAgo(8))] } })]} />);
    expect(within(row()).getByText(/Reminder sent .* to 3 creators\./)).toBeTruthy();
    expect(within(row()).getByText(/2 of 10 active creators still have nothing in/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send the last call" })).toBeTruthy();
    expect(card().className).toMatch(/border-l-brand-gold/);
  });

  it("says when the last call can go, and offers no button before then", () => {
    render(<ChallengeEditor challenges={[live({ reminder: { waiting: 2, active: 10, sent: [sentAt(1, hoursAgo(1))] } })]} />);
    expect(within(row()).getByText(/The last call can go from /)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Remind them|Send the last call/ })).toBeNull();
    expect(card().className).not.toMatch(/border-l-brand-gold/);
  });

  it("lists both once both have gone, and offers nothing more", () => {
    render(
      <ChallengeEditor
        challenges={[live({ reminder: { waiting: 1, active: 10, sent: [sentAt(1, hoursAgo(20)), sentAt(2, hoursAgo(6), { sent: 2, failed: 1 })] } })]}
      />,
    );
    expect(within(row()).getByText(/^Reminder sent .* to 3 creators\.$/)).toBeTruthy();
    expect(within(row()).getByText(/^Last call sent .* to 2 creators; 1 did not send\.$/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Remind them|Send the last call/ })).toBeNull();
    expect(card().className).not.toMatch(/border-l-brand-gold/);
  });

  it("says how far an unfinished send got, without claiming it stopped", () => {
    render(
      <ChallengeEditor
        challenges={[live({ reminder: { waiting: 5, active: 10, sent: [sentAt(1, hoursAgo(8), { sent: 40, finished: false })] } })]}
      />,
    );
    expect(screen.getByText(/40 sent so far\. It may still be sending, or it stopped part way; either way it will not send again\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Remind them|Send the last call/ })).toBeNull();
  });

  it("is not due days before the close", () => {
    render(<ChallengeEditor challenges={[live({ endsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString() })]} />);
    expect(card().className).not.toMatch(/border-l-brand-gold/);
    expect(screen.getByRole("button", { name: "Remind them" })).toBeTruthy();
  });

  it("turns the card gold on the day the first is due", () => {
    render(<ChallengeEditor challenges={[live()]} />);
    expect(card().className).toMatch(/border-l-brand-gold/);
  });

  it("says when everyone is in, with no button", () => {
    render(<ChallengeEditor challenges={[live({ reminder: { waiting: 0, active: 10, sent: [] } })]} />);
    expect(screen.getByText(/Every active creator has an entry in/)).toBeTruthy();
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

  it("does not appear on a week without reminder data (drafts, closed weeks)", () => {
    render(<ChallengeEditor challenges={[live({ reminder: undefined, status: "draft" })]} />);
    expect(screen.queryByText("Deadline reminders")).toBeNull();
  });
});
