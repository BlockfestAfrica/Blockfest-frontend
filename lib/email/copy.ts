import { sendEmailQuietly, type Email } from "@/lib/email/client";

/**
 * One copy of a bulk email, for the person the team named to see what went
 * out.
 *
 * The owner sends announcements and reminders to every creator and was never
 * on them, so had no way to see what people actually received. He asked to
 * be copied on every bulk send, and only him, not every admin.
 *
 * Who that is lives in BULK_EMAIL_COPY_TO (comma separated, server only),
 * never in the code: the repository is public, and an address committed to
 * it is an address published. Unset, nothing is copied.
 *
 * One copy per send, not a BCC on every mail: a stage announcement to three
 * hundred creators would otherwise be three hundred identical emails in one
 * inbox. The copy is the email exactly as the first recipient got it,
 * readdressed, with the subject saying it is a copy and how many it went to.
 * It goes out before the batch, so a send cut short still leaves the copy.
 *
 * None of the bulk templates carry a credential: they point at public pages
 * (the creator's own page, the voting page), never at a personal login
 * link, so a copy hands the reader nothing of the recipient's. A test pins
 * that for every template this is used with.
 */
export function bulkCopyRecipients(): string[] {
  return (process.env.BULK_EMAIL_COPY_TO ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter((address) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address));
}

export async function sendBulkCopy(
  sample: Email | null,
  sentTo: number,
  context: string,
): Promise<void> {
  if (!sample || sentTo === 0) return;
  for (const to of bulkCopyRecipients()) {
    await sendEmailQuietly(
      {
        ...sample,
        to,
        toName: undefined,
        subject: `[Copy · sent to ${sentTo}] ${sample.subject}`,
      },
      `${context} copy`,
    );
  }
}
