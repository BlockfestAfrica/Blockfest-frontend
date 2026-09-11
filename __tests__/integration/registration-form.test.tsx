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
import { toast } from "sonner";

// The Toaster is mounted in the root layout, not here, so a real toast call
// would be a silent no-op in this environment and an assertion on it would
// pass whether or not the form ever called it.
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

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
  // The sonner mock is module level, so its call history outlives a test
  // unless it is cleared. A "was not called" assertion is worthless otherwise.
  vi.clearAllMocks();
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

/**
 * A 400 from the server names the field it belongs to, and the form shows the
 * message against that field. That only works if something on the page is
 * watching the name. Three of them were not: the social inputs shared a single
 * slot bound to errors.x, and Location was passed no error prop at all. A
 * creator whose Instagram handle contained a space got a submit button that
 * flipped back to its resting state and nothing else, with no way to find out
 * why.
 */
describe("a field error the server sends back", () => {
  function respondWith(field: string, message: string) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ ok: false, field, message }),
      })) as unknown as typeof fetch,
    );
  }

  it.each([
    ["instagram", "Use just the username, for example yourname."],
    ["tiktok", "Use just the username, for example yourname."],
    ["location", "That is too long."],
    ["email", "That email address is already registered."],
  ])("is shown to the creator when it names %s", async (field, message) => {
    respondWith(field, message);
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() =>
      expect(
        screen.getAllByRole("alert").some((n) => n.textContent === message),
      ).toBe(true),
    );
  });

  it("still says something when the field is one no input owns", async () => {
    // Nothing can be shown against a field that is not on the page, but the
    // one outcome that must never happen is silence.
    respondWith("somethingNew", "Please check the form.");
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() =>
      expect(document.body.innerHTML).toContain("Please check the form."),
    );
  });
});

/**
 * The form sets noValidate so it can word its own messages, which means the
 * required attribute on the input enforces nothing at all. Without a check
 * here, an empty name reached the server and came back as a 400, so a creator
 * waited a round trip to be told something the page already knew.
 */
describe("a required field left empty", () => {
  it.each([
    ["Full name", "Add your name."],
    ["Email", "Add your email address."],
    ["Phone number", "Add your phone number"],
    ["What do you make?", "Tell us what kind of content you make."],
  ])("stops the submission and says so for %s", async (label, message) => {
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.change(screen.getByLabelText(label), { target: { value: "" } });
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() =>
      expect(
        screen.getAllByRole("alert").some((n) => n.textContent?.includes(message)),
      ).toBe(true),
    );
    expect(sent).toBeNull();
  });

  it("marks those fields as required in the markup too", () => {
    render(<RegistrationForm opensAt={OPENS_AT} />);
    for (const label of [
      "Full name",
      "Email",
      "Phone number",
      "What do you make?",
    ]) {
      expect(screen.getByLabelText(label).hasAttribute("required")).toBe(true);
    }
  });
});

/**
 * The project has had a toast system since before this form existed and the
 * form never used it. A whole-form failure is the case it is for: the message
 * renders above the submit button, which on a form this long can be well off
 * screen by the time somebody presses it.
 */
describe("a failure that belongs to the whole form", () => {
  it("is toasted as well as rendered inline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ ok: false, message: "Please check the form." }),
      })) as unknown as typeof fetch,
    );
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Please check the form."),
    );
    expect(document.body.innerHTML).toContain("Please check the form.");
  });

  it("is toasted when the server cannot be reached at all", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    );
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("could not reach the server"),
      ),
    );
  });

  it("does not toast a field error, which belongs beside its field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          ok: false,
          field: "email",
          message: "That email address is already registered.",
        }),
      })) as unknown as typeof fetch,
    );
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() =>
      expect(
        screen.getAllByRole("alert").some((n) =>
          n.textContent?.includes("already registered"),
        ),
      ).toBe(true),
    );
    expect(toast.error).not.toHaveBeenCalledWith(
      "That email address is already registered.",
    );
  });
});
