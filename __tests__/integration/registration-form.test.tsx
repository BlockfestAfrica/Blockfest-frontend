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
  fireEvent.change(screen.getByLabelText("Monica tag"), {
    target: { value: "adacreates" },
  });
  // Named, because there are two checkboxes now: accepting the rules, which is
  // required, and the optional marketing opt-in, which must stay untouched.
  fireEvent.click(
    screen.getByRole("checkbox", { name: /accept the campaign rules/i }),
  );
}

/*
 * Every waitFor here carries a five second ceiling, not the library's one
 * second default. The default lost a race on a saturated worker pool during
 * a full-suite run: the assertion was true, it just took 1.2 seconds to
 * become observable, and the deploy gate went red for it. Same lesson as the
 * throttle window test: a timing assumption in a test is a coin toss wired
 * to the deploy button. The ceiling changes nothing about what is asserted.
 */
describe("the submitted payload", () => {
  it("carries the honeypot field, even when empty", async () => {
    // The bug: this key was absent, so the server's honeypot branch could
    // never fire. An empty string is a real answer; undefined is silence.
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull(), { timeout: 5000 });
    expect(sent).toHaveProperty("hp_contact");
    expect(sent!.hp_contact).toBe("");
  });

  it("carries a timing measurement", async () => {
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull(), { timeout: 5000 });
    expect(sent).toHaveProperty("elapsedMs");
    expect(typeof sent!.elapsedMs).toBe("number");
  });

  it("carries the rules version that was on screen", async () => {
    // Consent is to a specific wording, and the rules can be amended mid
    // campaign. "They accepted the rules" is not an answer without this.
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull(), { timeout: 5000 });
    expect(sent!.rulesVersion).toBeTruthy();
    expect(sent!.acceptedRules).toBe(true);
  });

  it("sends what was typed, normalised on the server rather than dropped here", async () => {
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull(), { timeout: 5000 });
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

  /**
   * The state the site is actually in right now, and until this was written it
   * was the one state nothing covered. The suite ran with whatever
   * NEXT_PUBLIC_CAMPAIGN_GATE_OPEN happened to be in the environment, so it
   * passed on a laptop where the variable is unset and failed in the Netlify
   * build where it is true, having found the production configuration rather
   * than a defect.
   *
   * The flag is read once when lib/campaigns.ts is first imported, so moving it
   * means resetting the module registry and importing the component again.
   */
  it("renders the form when the gate is deliberately forced open", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_CAMPAIGN_GATE_OPEN", "true");

    const { RegistrationForm: Forced } = await import(
      "@/components/campaigns/registration-form"
    );

    vi.setSystemTime(new Date("2026-09-01T12:00:00+01:00"));
    const { container } = render(<Forced opensAt={OPENS_AT} />);

    expect(container.querySelector("form")).not.toBeNull();
    // And it says so, so nobody who wanders in early thinks it is launch day.
    expect(screen.getByText(/This is a test run/i)).toBeTruthy();

    vi.unstubAllEnvs();
    vi.resetModules();
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

    await waitFor(() => expect(screen.getByText(/You are in/i), { timeout: 5000 }).toBeTruthy());
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
      { timeout: 5000 },
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
      { timeout: 5000 },
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
    ["Monica tag", "Enter your Monica username."],
  ])("stops the submission and says so for %s", async (label, message) => {
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.change(screen.getByLabelText(label), { target: { value: "" } });
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() =>
      expect(
        screen.getAllByRole("alert").some((n) => n.textContent?.includes(message), { timeout: 5000 }),
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
      "Monica tag",
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
      { timeout: 5000 },
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
      { timeout: 5000 },
    );
  });

  it("toasts a field error as well as rendering it beside its field", async () => {
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
      { timeout: 5000 },
    );
    // Both. The inline message is the one that points at the field; the toast
    // is what makes it visible when the field is off screen.
    expect(toast.error).toHaveBeenCalledWith(
      "That email address is already registered.",
    );
  });

  it("moves focus to the field the error belongs to", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          ok: false,
          field: "phone",
          message: "That phone number is already registered.",
        }),
      })) as unknown as typeof fetch,
    );
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Phone number"), { timeout: 5000 }),
    );
  });
});

/**
 * Hearing about future campaigns is a different purpose from running this one,
 * so it is a separate question with its own answer. If it ever rode along with
 * accepting the rules, the consent would be worthless and would take the
 * campaign's own lawful basis with it.
 */
describe("the marketing opt-in", () => {
  it("is sent as false when nobody touches it", async () => {
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull(), { timeout: 5000 });
    expect(sent!.marketingOptIn).toBe(false);
  });

  it("is sent as true only when it is actually ticked", async () => {
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /future Blockfest Africa campaigns/i }),
    );
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull(), { timeout: 5000 });
    expect(sent!.marketingOptIn).toBe(true);
  });

  it("starts unticked, so consent is never a default", async () => {
    render(<RegistrationForm opensAt={OPENS_AT} />);
    const box = screen.getByRole("checkbox", {
      name: /future Blockfest Africa campaigns/i,
    }) as HTMLInputElement;
    expect(box.checked).toBe(false);
  });

  it("does not block registration when refused", async () => {
    // The line under it promises this. If refusing it could ever stop a
    // registration, the consent would not be freely given.
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(screen.getByText(/You are in/i), { timeout: 5000 }).toBeTruthy());
  });

  it("carries the privacy notice version that was on screen", async () => {
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull(), { timeout: 5000 });
    expect(sent!.privacyVersion).toBeTruthy();
  });
});

/**
 * The referral code, always on the page.
 *
 * /join sets a cookie, which covers somebody who follows a link. It did not
 * cover the creator who was sent a bare code in a WhatsApp message, which is
 * how codes actually travel: each creator is emailed their own code, and a code
 * forwards far more easily than a URL. So the box exists for everyone,
 * prefilled when a link carried the code in, and what is in the box is what
 * the server uses.
 */
describe("the referral code field", () => {
  it("is on the page for a direct visitor, empty", () => {
    render(<RegistrationForm opensAt={OPENS_AT} />);
    const box = screen.getByLabelText("Referral code") as HTMLInputElement;
    expect(box.value).toBe("");
  });

  it("sends what is typed as ref, upper-cased as the creator types", async () => {
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.change(screen.getByLabelText("Referral code"), {
      target: { value: "r3ww9ghf" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull(), { timeout: 5000 });
    expect(sent!.ref).toBe("R3WW9GHF");
  });

  it("omits ref entirely when the box is left empty", async () => {
    // An empty string would reach the database as a code resolving to nobody,
    // which is indistinguishable from a typo when somebody asks later why a
    // referral was not credited.
    render(<RegistrationForm opensAt={OPENS_AT} />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull(), { timeout: 5000 });
    expect(sent!.ref).toBeUndefined();
  });

  it("is shown prefilled to somebody who arrived through a referral link", () => {
    /*
     * This test's predecessor asserted the exact opposite: the field was
     * hidden when a referral cookie existed, because the cookie already
     * carried the code. Hidden, it was also the one place a wrong or stale
     * code could never be seen or corrected, and the cookie silently outranked
     * anything the creator might have typed. The field now renders for
     * everyone, carries the code the server already knows, and stays
     * editable.
     */
    render(
      <RegistrationForm
        opensAt={OPENS_AT}
        arrivedViaReferral
        initialRef="RQ4963ZV"
      />,
    );
    const box = screen.getByLabelText("Referral code") as HTMLInputElement;
    expect(box.value).toBe("RQ4963ZV");
    // And the hint says where the code came from, so nobody wonders whether
    // they were supposed to type something else.
    expect(
      screen.getByText(/came with the link that brought you here/i),
    ).toBeTruthy();
  });

  it("sends the prefilled code untouched when the creator leaves it alone", async () => {
    render(<RegistrationForm opensAt={OPENS_AT} initialRef="RQ4963ZV" />);
    fill();
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull(), { timeout: 5000 });
    expect(sent!.ref).toBe("RQ4963ZV");
  });

  it("sends the edited value when the creator corrects a prefilled code", async () => {
    // The point of showing the code at all. A prefill that could not be
    // corrected would just be the cookie wearing an input's clothes.
    render(<RegistrationForm opensAt={OPENS_AT} initialRef="RQ4963ZV" />);
    fill();
    fireEvent.change(screen.getByLabelText("Referral code"), {
      target: { value: "AB23CD45" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull(), { timeout: 5000 });
    expect(sent!.ref).toBe("AB23CD45");
  });

  it("omits ref when the creator clears a prefilled code", async () => {
    // Clearing the box is a decision, and the payload respects it. The server
    // may still fall back to the /join cookie, which is its call to make, but
    // the form does not resend a value somebody deliberately removed.
    render(<RegistrationForm opensAt={OPENS_AT} initialRef="RQ4963ZV" />);
    fill();
    fireEvent.change(screen.getByLabelText("Referral code"), {
      target: { value: "" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /register/i }));

    await waitFor(() => expect(sent).not.toBeNull(), { timeout: 5000 });
    expect(sent!.ref).toBeUndefined();
  });
});
