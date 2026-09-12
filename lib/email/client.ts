import "server-only";

/**
 * Transactional mail, through ZeptoMail.
 *
 * Three things here are the result of the account's actual configuration rather
 * than of preference, and each one fails in a way that looks like something
 * else.
 *
 * The host is the EU data centre. ZeptoMail runs regional endpoints and an
 * account lives in exactly one of them, so posting to api.zeptomail.com with a
 * valid EU key returns 401 with a message about the key. Anyone debugging that
 * will spend the afternoon on the token.
 *
 * The Authorization header is not a Bearer token. The value is the literal
 * string "Zoho-enczapikey" followed by the key, and the console shows it that
 * way, so the value pasted into the environment usually already carries the
 * prefix. It is normalised below rather than documented, because a convention
 * that has to be remembered at three in the morning is not a convention.
 *
 * And nothing here throws into its caller. A registration that succeeds and
 * then 500s because a mail provider was slow has lost a creator and kept the
 * row, which is the worst of both. Every send returns a result, and callers
 * carry on.
 */

/** Regional. Overridable only so a data centre move is not a code change. */
const ENDPOINT =
  process.env.ZEPTOMAIL_HOST?.trim() || "https://api.zeptomail.eu/v1.1/email";

/**
 * Serverless functions have a wall clock and a creator is waiting behind this.
 * Ten seconds is generous for an API call and still well inside the budget.
 */
const TIMEOUT_MS = 10_000;

export interface SendResult {
  sent: boolean;
  /** Set when the send did not happen. Safe to log: never contains the key. */
  reason?: string;
}

const NOT_CONFIGURED: SendResult = {
  sent: false,
  reason: "ZEPTOMAIL_TOKEN is not set",
};

export interface Email {
  to: string;
  /** Shown in the recipient's client. Falls back to the address. */
  toName?: string;
  subject: string;
  html: string;
  /** Plain text alternative. Always send one: see buildBody. */
  text: string;
  /**
   * Where a reply goes. The From address is noreply@, which is correct for
   * machine mail and wrong for a person who has a question, so every message
   * sets this to an address somebody reads.
   */
  replyTo?: string;
}

/**
 * The token, with the scheme prefix guaranteed.
 *
 * Accepts either form, because both are things a person reasonably pastes: the
 * console displays "Zoho-enczapikey <key>" as one value, while every code
 * sample writes the prefix separately.
 */
function authorization(): string | null {
  const raw = process.env.ZEPTOMAIL_TOKEN?.trim();
  if (!raw) return null;
  return raw.startsWith("Zoho-enczapikey") ? raw : `Zoho-enczapikey ${raw}`;
}

function sender(): { address: string; name: string } {
  return {
    address: process.env.ZEPTOMAIL_FROM?.trim() || "noreply@blockfestafrica.com",
    name: "Blockfest Africa",
  };
}

/**
 * Strip anything key-shaped out of text that is about to be logged.
 *
 * ZeptoMail echoes request details in some error bodies, and a 400 logged in
 * full is a credential in a log aggregator that outlives the campaign.
 */
function redact(text: string): string {
  return text.replace(/Zoho-enczapikey\s+\S+/gi, "Zoho-enczapikey [redacted]");
}

/**
 * Send one message.
 *
 * Never throws. Returns whether it went, and why not when it did not, so the
 * caller can log a line and get on with returning a response.
 */
export async function sendEmail(email: Email): Promise<SendResult> {
  const auth = authorization();
  if (!auth) {
    // Expected on previews and locally. Deliberately not an error: a developer
    // running the registration flow should not need a live mail provider.
    return NOT_CONFIGURED;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify({
        from: sender(),
        to: [
          {
            email_address: {
              address: email.to,
              ...(email.toName ? { name: email.toName } : {}),
            },
          },
        ],
        subject: email.subject,
        htmlbody: email.html,
        textbody: email.text,
        /*
         * Click tracking off, and this is a security control rather than a
         * preference about analytics.
         *
         * ZeptoMail's click tracking rewrites every href to pass through Zoho's
         * redirector, and the rewritten URL is stored in its click logs. The
         * registration email carries a creator's access link, which is a bearer
         * credential: with tracking on, that credential would travel through a
         * third party and sit readable in a console. lib/creator-access.ts is
         * built on the property that nobody, us included, can read a link back
         * out, and a default left on would quietly undo it.
         *
         * Set on every send rather than on the messages that carry a link,
         * because the one that gets forgotten is the one that leaks.
         */
        track_clicks: false,
        // The open pixel reports on people who never asked to be measured, and
        // nothing here acts on whether a message was opened.
        track_opens: false,
        ...(email.replyTo
          ? { reply_to: [{ address: email.replyTo, name: "Blockfest Africa" }] }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        sent: false,
        reason: `ZeptoMail ${response.status}: ${redact(body).slice(0, 400)}`,
      };
    }

    return { sent: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    return {
      sent: false,
      reason:
        controller.signal.aborted
          ? `timed out after ${TIMEOUT_MS}ms`
          : redact(message),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send, and never let the result matter to the caller.
 *
 * The shape most call sites want: the creator's registration has already
 * succeeded, so a mail failure is something to know about on Monday, not
 * something to tell them about now.
 */
export async function sendEmailQuietly(
  email: Email,
  context: string,
): Promise<void> {
  const result = await sendEmail(email);
  if (!result.sent) {
    console.warn(`[email] ${context} not sent: ${result.reason}`);
  }
}
