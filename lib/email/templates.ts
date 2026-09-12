import "server-only";
import { CONTACT_EMAIL } from "@/lib/constants";
import { monicaRoutes } from "@/lib/campaigns";
import type { Email } from "@/lib/email/client";

/**
 * The campaign's transactional emails.
 *
 * Written for a phone in a notification shade. The subject and the first line
 * have to carry the whole message, because that is all most of these are ever
 * read as, and the body is for the person who taps through.
 *
 * Built as tables with inline styles, which is not nostalgia. Outlook renders
 * with Word's engine and drops flexbox, grid and most of a stylesheet, and
 * Gmail strips anything in a head. A light background rather than the site's
 * dark one, because a dark email is still the thing that renders worst across
 * clients and this mail has to arrive legible everywhere or it has not arrived.
 *
 * No images at all. Every one of these carries something the recipient needs to
 * act on, and images are blocked by default in enough clients that a message
 * whose meaning depends on one is a message that sometimes means nothing.
 */

/*
 * The brand gold exactly, not a near miss.
 *
 * The first version used a darker #d4a227 because #F2CB45 is unreadable as
 * small text on white, about 1.6:1. Solving that by inventing a second gold is
 * worse than not using gold at all: a recipient sees the site and the email
 * side by side and the email looks like a cheap copy of it.
 *
 * So the real token is used where it works, as a filled surface with black on
 * it, and nowhere else. That is the same rule the site follows, where gold is
 * a fill and an edge rather than a text colour.
 */
const GOLD = "#F2CB45";
const INK = "#16181d";
const MUTED = "#5b6270";
const LINE = "#e4e6ea";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://blockfestafrica.com"
  );
}

/**
 * Escape before interpolation, everywhere, without exception.
 *
 * Creator names, review notes and submitted URLs all reach these templates
 * straight from a text input. A name containing a less-than sign would break
 * the markup; a review note is written by an admin but read by a creator, and
 * treating admin-written text as trusted markup is how a mail template becomes
 * an injection point the day an admin account is borrowed.
 */
function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The absolute link a creator gets back in with.
 *
 * Built from the configured site URL rather than from the incoming request.
 * A registration made on a deploy preview would otherwise email a link to that
 * preview, which stops resolving the moment the next deploy supersedes it, and
 * the failure arrives days later as a creator who cannot get in.
 */
export function personalLink(accessToken: string): string {
  return `${siteUrl()}${monicaRoutes.enter}?t=${encodeURIComponent(accessToken)}`;
}

/** Their own page, with no secret in it. Safe in any message. */
export function personalPage(): string {
  return `${siteUrl()}${monicaRoutes.me}`;
}

/** First name only, and never empty: some people register with one word. */
export function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : "there";
}

/*
 * Who escapes what, because getting this wrong silently is easy and it already
 * happened once.
 *
 * layout() and boxed() escape their own arguments, so callers pass raw text.
 * p() and quiet() do NOT, because their whole purpose is to carry small pieces
 * of markup such as a bolded figure, so anything interpolated into them must be
 * escaped at the call site.
 *
 * The first version escaped the heading in both places. A creator named
 * "Tom & Jerry Media" would have opened an email addressed to
 * "Tom &amp; Jerry Media". The tests now assert the absence of &amp;amp;.
 */
interface Shell {
  /** Shown in the inbox preview line, after the subject. */
  preheader: string;
  heading: string;
  /** Already-escaped HTML paragraphs and blocks. */
  body: string;
  action?: { label: string; href: string };
}

function layout({ preheader, heading, body, action }: Shell): string {
  const button = action
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
        <tr><td style="border-radius:999px;background:${GOLD};">
          <a href="${action.href}" style="display:inline-block;padding:14px 30px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#111111;text-decoration:none;border-radius:999px;">${escape(action.label)}</a>
        </td></tr>
      </table>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid ${LINE};overflow:hidden;">
    <tr><td style="height:5px;background:${GOLD};line-height:5px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="padding:28px 28px 8px;">
      <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${MUTED};">Monica: The Money Story</p>
      <h1 style="margin:12px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:24px;line-height:1.25;font-weight:700;color:${INK};">${escape(heading)}</h1>
    </td></tr>
    <tr><td style="padding:4px 28px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${INK};">
      ${body}
      ${button}
    </td></tr>
    <tr><td style="padding:20px 28px 28px;border-top:1px solid ${LINE};font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${MUTED};">
      <p style="margin:0;">Blockfest Africa, for the Monica campaign. Reply to this email and a person reads it.</p>
      <p style="margin:8px 0 0;"><a href="${siteUrl()}${monicaRoutes.rules}" style="color:${MUTED};">Rules</a> &nbsp;·&nbsp; <a href="${siteUrl()}${monicaRoutes.privacy}" style="color:${MUTED};">How we handle your details</a></p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

const p = (text: string) =>
  `<p style="margin:0 0 14px;">${text}</p>`;

const quiet = (text: string) =>
  `<p style="margin:0 0 14px;font-size:13px;color:${MUTED};">${text}</p>`;

/** A value to read back or copy, set apart from the prose around it. */
const boxed = (label: string, value: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;">
     <tr><td style="padding:14px 16px;background:#f7f8fa;border:1px solid ${LINE};border-radius:10px;">
       <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${MUTED};">${escape(label)}</p>
       <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:${INK};word-break:break-all;">${escape(value)}</p>
     </td></tr>
   </table>`;

// ---------------------------------------------------------------------------

/**
 * Registration.
 *
 * This one carries the personal link, and that is a real decision rather than a
 * convenience. The link is a bearer secret: whoever holds it is the creator.
 * Putting it in an email means an inbox somebody else can read is an account
 * somebody else can use.
 *
 * It is worse than it first looks: the token does not expire. The 90 day figure
 * in lib/creator-access.ts is the cookie /enter sets, not the credential. The
 * token itself is valid until an admin issues a replacement, so this puts a
 * permanent credential into a mailbox and the only revocation is manual.
 *
 * It goes in anyway, for two reasons. The link was previously shown once, on a
 * confirmation screen, and told to save it, which is a plan that fails for the
 * ordinary reason that people close tabs. The alternative, on the owner's own
 * account of it, was writing to an address and waiting for a human to reissue
 * one. And the thing being protected is a page showing somebody's own points
 * and a form for their own entries: worth protecting, not worth locking a
 * creator out of their entry on a deadline to protect.
 *
 * One harm this newly creates, which is worth naming rather than discovering:
 * the registered address is never verified, so a creator who mistypes it now
 * sends a working credential to a stranger instead of merely losing their own
 * support route. The mail says what the link is so that forwarding it is at
 * least an informed choice, and says to reply if it was not expected.
 *
 * The mail says plainly what the link is, so the choice to forward it is an
 * informed one.
 */
export function registrationEmail(params: {
  to: string;
  fullName: string;
  personalLink: string;
  referralCode: string;
}): Email {
  const name = firstName(params.fullName);
  const link = siteUrl();

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: "Your Monica campaign link, keep this email",
    text: [
      `${name}, you are registered for Monica: The Money Story.`,
      ``,
      `Your personal link:`,
      params.personalLink,
      ``,
      `That link IS your sign in and it does not expire. Anyone who opens it is you, so do not post it publicly or forward this email. Keep it and you can always get back in.`,
      `If you did not register for this, reply and tell us.`,
      ``,
      `Your referral code: ${params.referralCode}`,
      `You earn 50 points when somebody who joins with your code gets their first entry approved.`,
      ``,
      `A new brief opens every Monday. Publish your answer on your own account, then paste the link on your page.`,
      ``,
      `Rules: ${link}${monicaRoutes.rules}`,
      `Creator pack: ${link}${monicaRoutes.pack}`,
      ``,
      `Reply to this email if you need anything.`,
    ].join("\n"),
    html: layout({
      preheader: "Your personal link is inside. Keep this email.",
      heading: `${name}, you are in`,
      body: [
        p("Keep this email. The link below is how you get back to your page, every week."),
        boxed("Your personal link", params.personalLink),
        quiet(
          "That link is your sign in and it does not expire. Anybody who opens it is you, so do not post it anywhere public or forward this email. If you lose it, reply from the address you registered with and we will issue a new one, which stops the old one working. If you did not register for this, reply and tell us.",
        ),
        boxed("Your referral code", params.referralCode),
        p(
          "You earn <strong>50 points</strong> when a creator who joins with your code gets their first entry approved. Not when they register, when their work is accepted.",
        ),
        p(
          "A new brief opens every Monday. Publish your answer on your own account, then paste the link on your page.",
        ),
      ].join(""),
      action: { label: "Open your page", href: params.personalLink },
    }),
  };
}

/**
 * Approved.
 *
 * The owner's words: "there is no any other email being sent when approval has
 * been done." A creator who published something and heard nothing has no way to
 * tell being accepted from being ignored.
 *
 * Leads with the number, because that is the answer to the question that made
 * them open it.
 */
export function approvalEmail(params: {
  to: string;
  fullName: string;
  weekNo: number;
  platformLabel: string;
  pointsAwarded: number;
  pointsTotal: number;
  personalPage: string;
}): Email {
  const name = firstName(params.fullName);
  const earned =
    params.pointsAwarded > 0
      ? `You earned ${params.pointsAwarded} points, taking you to ${params.pointsTotal}.`
      : `Your total is ${params.pointsTotal} points.`;

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: `Approved: your week ${params.weekNo} entry`,
    text: [
      `${name}, your week ${params.weekNo} entry on ${params.platformLabel} was approved.`,
      ``,
      earned,
      ``,
      `Posting the same piece on another platform earns more for the same entry: one platform is 100 points, two is 200, three is 300.`,
      ``,
      `Your page: ${params.personalPage}`,
    ].join("\n"),
    html: layout({
      preheader: earned,
      heading: `Approved, ${name}`,
      body: [
        p(
          `Your week ${params.weekNo} entry on ${escape(params.platformLabel)} has been accepted.`,
        ),
        boxed("Your points", `${params.pointsTotal}`),
        p(escape(earned)),
        quiet(
          "Posting the same piece on another platform earns more for the same entry: one platform is 100 points, two is 200, three is 300.",
        ),
      ].join(""),
      action: { label: "See where you stand", href: params.personalPage },
    }),
  };
}

/**
 * Not accepted.
 *
 * The note is the entire message. A rejection without one is something a
 * creator argues with rather than learns from, which is why the API refuses to
 * record one, and sending the decision without the reason would put that back.
 *
 * Worded so it is survivable. Somebody made something and it was turned down,
 * and the next thing they decide is whether to make another.
 */
export function rejectionEmail(params: {
  to: string;
  fullName: string;
  weekNo: number;
  platformLabel: string;
  note: string;
  personalPage: string;
  canResubmit: boolean;
}): Email {
  const name = firstName(params.fullName);
  const again = params.canResubmit
    ? "This week is still open, so you can fix it and send it again."
    : "The week has closed, but the next brief is a fresh start.";

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: `Your week ${params.weekNo} entry needs a change`,
    text: [
      `${name}, your week ${params.weekNo} entry on ${params.platformLabel} was not accepted.`,
      ``,
      `Why:`,
      params.note,
      ``,
      again,
      ``,
      `Your page: ${params.personalPage}`,
      `If you think this is wrong, reply to this email and a person will look at it again.`,
    ].join("\n"),
    html: layout({
      preheader: "Here is what to change.",
      heading: `${name}, this one needs a change`,
      body: [
        p(
          `Your week ${params.weekNo} entry on ${escape(params.platformLabel)} was not accepted.`,
        ),
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;">
           <tr><td style="padding:14px 16px;background:#fdf6f6;border-left:3px solid #d47a7a;border-radius:0 10px 10px 0;">
             <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${MUTED};">Why</p>
             <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${INK};">${escape(params.note)}</p>
           </td></tr>
         </table>`,
        p(escape(again)),
        quiet(
          "If you think this is wrong, reply to this email and a person will look at it again.",
        ),
      ].join(""),
      action: { label: "Open your page", href: params.personalPage },
    }),
  };
}

/**
 * A reissued link.
 *
 * Sent when an admin issues a replacement. Says that the old one stopped
 * working, because otherwise the first thing the creator does is try the old
 * one, fail, and conclude the campaign is broken.
 */
export function reissueEmail(params: {
  to: string;
  fullName: string;
  personalLink: string;
}): Email {
  const name = firstName(params.fullName);

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: "Your new Monica campaign link",
    text: [
      `${name}, here is a new personal link for the campaign.`,
      ``,
      params.personalLink,
      ``,
      `Your old link has stopped working. This one replaces it. Keep this email.`,
      ``,
      `Your points and your entries are untouched.`,
    ].join("\n"),
    html: layout({
      preheader: "Your old link has stopped working. This one replaces it.",
      heading: `${name}, here is a new link`,
      body: [
        boxed("Your personal link", params.personalLink),
        p(
          "Your old link has stopped working and this one replaces it. Keep this email.",
        ),
        quiet(
          "Your points and your entries are untouched. Anybody who opens this link is you, so do not post it anywhere public.",
        ),
      ].join(""),
      action: { label: "Open your page", href: params.personalLink },
    }),
  };
}
