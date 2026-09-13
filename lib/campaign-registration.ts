import { z } from "zod";

/**
 * The cookie carrying a referral from the click through to the submitted form.
 *
 * Defined here rather than in the /join route because Next only allows known
 * exports from a route module, and both the route that sets it and the handler
 * that reads it need the same string. Two string literals that must match is
 * exactly the kind of thing that silently stops matching.
 */
export const REFERRAL_COOKIE = "monica_ref";

/**
 * Registering for a campaign.
 *
 * The validation here is the anti-fraud story. Points convert to money, the
 * referral programme pays for bringing people in, and the cheapest attack on
 * both is one person registering as several. Uniqueness constraints in the
 * database are what stop that, but a unique index only stops what it can see as
 * identical: `A.B+monica@gmail.com` and `ab@gmail.com` are the same mailbox and
 * a plain unique index treats them as two people. So every identifier is
 * normalised to a canonical form before it is compared, and the canonical form
 * is what carries the constraint.
 *
 * The original is kept as well. We contact creators on what they typed, and a
 * dot stripped for comparison should not turn into a dot missing from an email
 * we send.
 */

/** Providers that ignore dots in the local part, so a.b@ and ab@ are one inbox. */
const DOT_INSENSITIVE = new Set(["gmail.com", "googlemail.com"]);

/**
 * The form a comparison uses. Never shown, never emailed.
 *
 * Lowercased, the +tag dropped, and dots removed for providers that ignore
 * them. Gmail's own rules, applied on our side, because otherwise one mailbox
 * yields unlimited "unique" accounts for the cost of typing a plus sign.
 */
export function canonicalEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return trimmed;

  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);

  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (DOT_INSENSITIVE.has(domain)) local = local.replaceAll(".", "");

  return `${local}@${domain}`;
}

/**
 * A phone number in E.164, so +2348012345678 and 08012345678 compare equal.
 *
 * A bare number beginning 0 is read as Nigerian. That is an assumption, and it
 * is the right one: the campaign is open to creators anywhere but the audience
 * is overwhelmingly Nigerian, and a Nigerian creator typing their number the
 * way they always type it should not be told it is invalid. Anyone outside
 * Nigeria has to include their country code, which the form asks for.
 *
 * Returns null when it cannot be read, rather than guessing.
 */
export function canonicalPhone(input: string): string | null {
  const cleaned = input.replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  let digits: string;
  if (cleaned.startsWith("+")) {
    digits = cleaned.slice(1).replace(/\D/g, "");
  } else if (cleaned.startsWith("234")) {
    digits = cleaned;
  } else if (cleaned.startsWith("0")) {
    digits = `234${cleaned.replace(/\D/g, "").slice(1)}`;
  } else {
    // No country code and no leading zero. Too ambiguous to guess at.
    return null;
  }

  // Shortest national numbers run to about 8 digits, longest E.164 is 15.
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/**
 * A social handle, stripped to the name itself.
 *
 * Creators paste whatever is in front of them: a bare handle, an @ prefix, or
 * the whole profile URL. All three mean the same account and must compare
 * equal, because the handle is the strongest identity we hold. Entries have to
 * be published from it, which makes it harder to fake than an email address.
 */
export function canonicalHandle(input: string): string {
  let value = input.trim().toLowerCase();

  // A pasted profile URL: take the last meaningful path segment.
  if (value.includes("/")) {
    const parts = value.split("?")[0].split("/").filter(Boolean);
    value = parts[parts.length - 1] ?? "";
  }

  return value.replace(/^@+/, "").trim();
}

const handleField = z
  .string()
  .trim()
  .max(120, "That looks too long for a username.")
  .transform((v) => canonicalHandle(v))
  .refine((v) => v === "" || /^[a-z0-9._]{1,40}$/.test(v), {
    message: "Use just the username, for example yourname.",
  });

export const registrationSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Tell us your name.")
      .max(120, "That name is too long."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("That email address does not look right.")
      .max(254),
    phone: z
      .string()
      .trim()
      .min(
        6,
        "Add your phone number, with country code if you are outside Nigeria.",
      )
      .max(32),
    x: handleField.optional().default(""),
    instagram: handleField.optional().default(""),
    tiktok: handleField.optional().default(""),
    /**
     * Their username on Monica, and how prize money reaches them.
     *
     * This replaced "what kind of content do you make", which was required,
     * written once and never read back by anything. Asking for the tag at
     * registration is far better than asking a winner for it afterwards, when
     * they may have gone quiet and the prize is already committed to a name.
     *
     * A leading @ is accepted and stripped, because that is how people write a
     * username and refusing it would be a rejection over punctuation.
     */
    monicaTag: z
      .string()
      .trim()
      .transform((v) => v.replace(/^@+/, ""))
      .pipe(
        z
          .string()
          .min(2, "Enter your Monica username.")
          .max(40, "That is longer than a Monica username.")
          .regex(
            /^[A-Za-z0-9._-]+$/,
            "A Monica username is letters, numbers, dots, dashes and underscores.",
          ),
      ),
    audienceSize: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
    location: z.string().trim().max(120).optional(),
    /**
     * Consent is not a checkbox we can infer later. It has to be given before
     * the record exists, and which wording it was given against has to be
     * recorded, because the rules can be amended during the campaign.
     */
    acceptedRules: z.literal(true, {
      message: "You need to accept the campaign rules.",
    }),
    rulesVersion: z.string().min(1),
    /**
     * Optional and unticked. Refusing it must change nothing about the entry,
     * so it is never required and never blocks a registration. Absent is the
     * same as no, which is why it defaults rather than erroring.
     */
    marketingOptIn: z.boolean().optional().default(false),
    /** Which privacy notice was on screen when they answered. */
    privacyVersion: z.string().min(1).optional(),
    /** Referral code carried from /join. Absent for a direct visitor. */
    ref: z.string().trim().max(64).optional(),
    /**
     * A field no person can see or tab to. Anything in it came from something
     * filling every input it found, which is the cheapest signal there is and
     * costs a real creator nothing.
     */
    hp_contact: z.string().max(200).optional(),
    /**
     * Milliseconds between the form appearing and being submitted.
     *
     * A person cannot complete nine fields in under a couple of seconds. A
     * script can do it in tens of milliseconds, and typically does, because
     * there is no reason for it to wait. Trivially forgeable by anyone who
     * looks, which is the point: this is for the traffic that does not look.
     */
    elapsedMs: z.coerce.number().int().min(0).optional(),
  })
  .refine((v) => v.x !== "" || v.instagram !== "" || v.tiktok !== "", {
    message: "Add at least one account you will be publishing from.",
    path: ["x"],
  })
  .refine((v) => canonicalPhone(v.phone) !== null, {
    message: "Add the country code, for example +234 803 000 0000.",
    path: ["phone"],
  });

export type RegistrationInput = z.input<typeof registrationSchema>;
export type Registration = z.output<typeof registrationSchema>;

/** Every identifier in the canonical form the database compares on. */
export function canonicalise(input: Registration) {
  return {
    emailCanonical: canonicalEmail(input.email),
    phoneE164: canonicalPhone(input.phone)!,
    handles: {
      x: input.x || null,
      instagram: input.instagram || null,
      tiktok: input.tiktok || null,
    },
  };
}

/**
 * How long a genuine person takes, at the very fastest.
 *
 * Deliberately low. The cost of getting this wrong is turning away a real
 * creator who types quickly or pastes from notes, which is far worse than
 * letting through a bot that waits three seconds. It is one layer of several,
 * not a wall.
 */
export const MIN_HUMAN_FILL_MS = 2_500;

/**
 * Whether a submission looks automated.
 *
 * Returns the reason rather than a boolean so it can be logged. None of these
 * signals is conclusive on its own and none is shown to the visitor: telling a
 * bot which check it failed is telling whoever wrote it what to change.
 */
export function looksAutomated(input: {
  hp_contact?: string;
  elapsedMs?: number;
}): string | null {
  if (input.hp_contact && input.hp_contact.trim() !== "") return "honeypot";
  if (
    typeof input.elapsedMs === "number" &&
    input.elapsedMs < MIN_HUMAN_FILL_MS
  ) {
    return `too-fast:${input.elapsedMs}ms`;
  }
  return null;
}
