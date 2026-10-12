/**
 * The ROVV entry form as an entrant meets it on a phone (the end-to-end
 * walk, 12 October): the draft that survives opening the rules, the honest
 * success screen, the typo offer, the close, and the slow network.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RovvEntryForm } from "@/components/campaigns/rovv-entry-form";

vi.mock("@/lib/sabilytics", () => ({ ROVV_EVENTS: { entryStarted: "s", entrySubmitted: "d" }, track: vi.fn() }));

const OPEN = new Date("2026-10-14T10:00:00+01:00");
const answer = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: OPEN });
  window.localStorage.clear();
  answer.mockReset();
  answer.mockResolvedValue({ ok: true, json: async () => ({ ok: true, outcome: "created", test: false, emailed: true }) });
  vi.stubGlobal("fetch", answer);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function fill(over: Partial<Record<string, string>> = {}) {
  const values = {
    fullName: "Ada Obi",
    email: "ada@example.test",
    tiktokHandle: "adaobi",
    tiktokUrl: "https://vm.tiktok.com/ZMabc123/",
    referralCode: "ada.123",
    ...over,
  };
  for (const [id, value] of Object.entries(values)) {
    fireEvent.change(document.getElementById(id)!, { target: { value } });
  }
  fireEvent.click(document.getElementById("acceptedRules")!);
}

describe("the ROVV entry form", () => {
  it("keeps what was typed as a draft, so opening the rules or a reload loses nothing, and never the consent tick", async () => {
    const first = render(<RovvEntryForm />);
    await fill();
    first.unmount();
    render(<RovvEntryForm />);
    expect((document.getElementById("email") as HTMLInputElement).value).toBe("ada@example.test");
    expect((document.getElementById("referralCode") as HTMLInputElement).value).toBe("ada.123");
    expect((document.getElementById("acceptedRules") as HTMLInputElement).checked).toBe(false);
  });

  it("opens the rules and the privacy notice in a new tab", () => {
    render(<RovvEntryForm />);
    for (const name of ["campaign rules", "privacy notice"]) {
      expect(screen.getByRole("link", { name }).getAttribute("target")).toBe("_blank");
    }
  });

  it("offers the right address for a mistyped domain, without refusing the one typed", () => {
    render(<RovvEntryForm />);
    const email = document.getElementById("email")!;
    fireEvent.change(email, { target: { value: "ada@gmail.con" } });
    fireEvent.blur(email);
    fireEvent.click(screen.getByRole("button", { name: "ada@gmail.com" }));
    expect((email as HTMLInputElement).value).toBe("ada@gmail.com");
  });

  it("shows the address the copy went to, and clears the draft", async () => {
    render(<RovvEntryForm />);
    await fill();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Send my entry/ }));
    });
    expect(await screen.findByText("You're in.")).toBeTruthy();
    expect(screen.getByText("ada@example.test")).toBeTruthy();
    expect(screen.getByText(/We have emailed a copy to/)).toBeTruthy();
    expect(window.localStorage.getItem("rovv-entry-draft")).toBeNull();
    // Kept as typed: the code is not upper-cased on the way.
    expect(JSON.parse(String((answer.mock.calls[0][1] as RequestInit).body)).referralCode).toBe("ada.123");
  });

  it("says so when the copy could not be emailed, instead of claiming it was", async () => {
    answer.mockResolvedValue({ ok: true, json: async () => ({ ok: true, outcome: "created", test: false, emailed: false }) });
    render(<RovvEntryForm />);
    await fill();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Send my entry/ }));
    });
    expect(await screen.findByText(/we could not email a copy to/)).toBeTruthy();
    expect(screen.queryByText(/We have emailed a copy/)).toBeNull();
  });

  it("turns to 'closed' when the server says entries have closed", async () => {
    answer.mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, message: "Entries closed at 11:59 PM on Sunday 18 October, Lagos time.", closed: true }),
    });
    render(<RovvEntryForm />);
    await fill();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Send my entry/ }));
    });
    expect(await screen.findByText("Entries are closed.")).toBeTruthy();
  });

  it("tells a person on a dropped connection that sending again is safe", async () => {
    answer.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<RovvEntryForm />);
    await fill();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Send my entry/ }));
    });
    expect(await screen.findByText(/Sending twice is safe/)).toBeTruthy();
  });

  it("says when entries open, unambiguously, before they do", () => {
    vi.setSystemTime(new Date("2026-10-12T20:00:00+01:00"));
    render(<RovvEntryForm />);
    expect(screen.getByText(/Tuesday 13 October at 12:00 AM, Lagos time: the moment Monday night ends/)).toBeTruthy();
  });

  it("times a restored draft from when typing began, so a quick send after coming back is never taken for a bot", async () => {
    const first = render(<RovvEntryForm />);
    await fill();
    vi.setSystemTime(new Date(OPEN.getTime() + 60_000));
    first.unmount();
    render(<RovvEntryForm />);
    fireEvent.click(document.getElementById("acceptedRules")!);
    vi.setSystemTime(new Date(OPEN.getTime() + 60_500));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Send my entry/ }));
    });
    const sent = JSON.parse(String((answer.mock.calls[0][1] as RequestInit).body)) as { elapsedMs: number };
    expect(sent.elapsedMs).toBeGreaterThanOrEqual(2_500);
  });

  it("shows when entries open, not 'closed', when the server says they have not opened yet", async () => {
    answer.mockResolvedValue({ ok: false, json: async () => ({ ok: false, message: "Entries open at midnight.", closed: "before" }) });
    render(<RovvEntryForm />);
    await fill();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Send my entry/ }));
    });
    expect(await screen.findByText(/Entries open on Tuesday 13 October/)).toBeTruthy();
    expect(screen.queryByText("Entries are closed.")).toBeNull();
  });

  it("asks for the copy again on the next send when the last one could not be emailed", async () => {
    answer.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, outcome: "created", test: false, emailed: false }) });
    render(<RovvEntryForm />);
    await fill();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Send my entry/ }));
    });
    fireEvent.click(await screen.findByRole("button", { name: "Change my entry" }));
    // The consent box is still ticked from the first send.
    expect((document.getElementById("acceptedRules") as HTMLInputElement).checked).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Send my entry/ }));
    });
    expect(JSON.parse(String((answer.mock.calls[1][1] as RequestInit).body)).resendReceipt).toBe(true);
  });
});
