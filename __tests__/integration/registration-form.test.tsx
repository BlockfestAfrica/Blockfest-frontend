/**
 * What the registration form actually sends.
 *
 * This file exists because of a bug it would have caught. The honeypot and the
 * timing check were written, unit-tested in isolation, verified in a browser as
 * invisible and untabbable, and reported as working. None of that touched the
 * one thing that mattered: the form never put either value in the request body,
 * so the server received undefined for both and waved through every submission
 * for as long as the feature existed.
 *
 * Testing looksAutomated() with hand-built objects proves the function works.
 * It says nothing about whether the form feeds it. So these tests assert on the
 * serialised payload, which is the only place the two halves meet.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegistrationForm } from "@/components/campaigns/registration-form";

/** After the campaign opens, so the form renders rather than the locked notice. */
const OPENS_AT = "2026-09-14T00:00:00+01:00";
const AFTER_OPENING = new Date("2026-09-20T12:00:00+01:00");

let sent: Record<string, unknown> | null = null;

beforeEach(() => {
  sent = null;
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(AFTER_OPENING);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body ?? "{}"));
      return {
        ok: true,
        json: async () => ({
          ok: true,
          name: "Ada Obi",
          referralCode: "ABCD2345",
        }),
      } as Response;
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function fill() {
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "Ada Obi" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "ada@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Phone number"), {
    target: { value: "08012345678" },
  });
  fireEvent.change(screen.getByLabelText("X username"), {
    target: { value: "adacreates" },
  });
  fireEvent.change(screen.getByLabelText("What do you make?"), {
    target: { value: "Finance explainers" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("the submitted payload", () => {
  it("carries the honeypot field, even when empty", async () => {
    // The bug: this key was absent, so the server's honeypot branch could
    // never fire. An empty string is a real answer; undefined is silence.
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toHaveProperty("hp_contact");
    expect(sent!.hp_contact).toBe("");
  });

  it("carries a timing measurement", async () => {
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toHaveProperty("elapsedMs");
    expect(typeof sent!.elapsedMs).toBe("number");
  });

  it("carries the rules version that was on screen", async () => {
    // Consent is to a specific wording, and the rules can be amended mid
    // campaign. "They accepted the rules" is not an answer without this.
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent!.rulesVersion).toBeTruthy();
    expect(sent!.acceptedRules).toBe(true);
  });

  it("sends what was typed, normalised on the server rather than dropped here", async () => {
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent!.fullName).toBe("Ada Obi");
    expect(sent!.email).toBe("ada@example.com");
    expect(sent!.x).toBe("adacreates");
  });
});

describe("before the campaign opens", () => {
  it("does not render a form at all", () => {
    vi.setSystemTime(new Date("2026-09-01T12:00:00+01:00"));
    const { container } = render(<RegistrationForm opensAt={OPENS_AT} />);
    expect(container.querySelector("form")).toBeNull();
    expect(screen.getByText(/not open yet/i)).toBeTruthy();
  });
});

describe("when the server returns no referral code", () => {
  it("does not offer a broken share link", async () => {
    // The path a false positive on the bot checks lands on. It must not hand
    // somebody .../join?ref=null dressed up as a reward.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, name: "Ada Obi", referralCode: null }),
      })) as unknown as typeof fetch,
    );
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(screen.getByText(/You are in/i)).toBeTruthy());
    expect(document.body.innerHTML).not.toContain("ref=null");
  });
});
