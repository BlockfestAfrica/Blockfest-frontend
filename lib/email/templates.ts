import "server-only";
import { CONTACT_EMAIL } from "@/lib/constants";
import { monicaPointLadder, monicaRoutes } from "@/lib/campaigns";
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

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://blockfestafrica.com"
  );
}

/** The public voting section, where a ballot and its results live. */
export function votingPage(): string {
  return `${siteUrl()}${monicaRoutes.winners}#shortlist`;
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

/**
 * The self-service recovery confirmation link.
 *
 * Carries a token that is single use and expires in thirty minutes, unlike
 * personalLink's token, which is the whole point: this one exists to be
 * clicked once, not kept.
 */
export function recoveryLink(recoveryToken: string): string {
  return `${siteUrl()}${monicaRoutes.recoverOpen}?t=${encodeURIComponent(recoveryToken)}`;
}

/** First name only, and never empty: some people register with one word. */
/**
 * The tier line, derived rather than typed.
 *
 * This sentence carried the old 100/200/300 ladder into every approval email
 * for a day after the rules changed to 100/150/200, which is what a second
 * copy of a number does. monicaPointLadder is the same array the page and the
 * engine read.
 */
const LADDER_LINE = `Posting the same piece on another platform earns more for the same entry: ${monicaPointLadder
  .map(
    (tier) =>
      `${tier.platforms} platform${tier.platforms > 1 ? "s" : ""} is ${tier.points} points`,
  )
  .join(", ")}.`;

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
          <a href="${escape(action.href)}" style="display:inline-block;padding:14px 30px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#111111;text-decoration:none;border-radius:999px;">${escape(action.label)}</a>
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
      `We will never ask you to send us your link, and a genuine link from us always starts with blockfestafrica.com. A replacement only ever arrives after you ask for one, on the campaign site or by writing to us, and only ever to this address.`,
      ``,
      `Your referral code: ${params.referralCode}`,
      `You earn 10 points when somebody who joins with your code gets their first entry approved.`,
      ``,
      `A new challenge drops with every stage; from Stage 2 onward that is every Monday. Publish your answer on your own account, then paste the link on your page.`,
      ``,
      `Rules: ${link}${monicaRoutes.rules}`,
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
          "That link is your sign in and it does not expire. Anybody who opens it is you, so do not post it anywhere public or forward this email. If you lose it, the Lost your link page on the campaign site mails a fresh one to this address, and the old one stops working. If you did not register for this, reply and tell us.",
        ),
        quiet(
          "We will never ask you to send us your link, and a genuine link from us always starts with blockfestafrica.com. A replacement only ever arrives after you ask for one, on the campaign site or by writing to us, and only ever to this address.",
        ),
        boxed("Your referral code", params.referralCode),
        p(
          "You earn <strong>10 points</strong> when a creator who joins with your code gets their first entry approved. Not when they register, when their work is accepted.",
        ),
        p(
          "A new challenge drops with every stage; from Stage 2 onward that is every Monday. Publish your answer on your own account, then paste the link on your page.",
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
      LADDER_LINE,
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
        quiet(LADDER_LINE),
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
    : "The week has closed, but the next challenge is a fresh start.";

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
      ``,
      `A genuine replacement like this one only ever arrives after you asked us for it, and only to this address. We will never ask you to send us your link; a mail that does is not from us.`,
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
        quiet(
          "A genuine replacement like this one only ever arrives after you asked us for it, and only to this address. We will never ask you to send us your link; a mail that does is not from us.",
        ),
      ].join(""),
      action: { label: "Open your page", href: params.personalLink },
    }),
  };
}

/**
 * A self-service recovery link. Closes #206, successor to #78.
 *
 * Sent when somebody, hopefully the creator, types this address into the
 * "lost your link?" form. States plainly that clicking is what does
 * something, because the mail may have been requested by somebody other
 * than the creator and the one thing that must be unambiguous is that
 * reading this mail and doing nothing leaves the working link untouched.
 *
 * Unlike reissueEmail, the old link has NOT stopped working yet when this
 * arrives: rotation happens only on the click, so the mail is careful not to
 * say otherwise.
 */
export function recoveryRequestEmail(params: {
  to: string;
  fullName: string;
  confirmLink: string;
}): Email {
  const name = firstName(params.fullName);

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: "Get back into your Monica campaign page",
    text: [
      `${name}, somebody asked to get back into your Monica campaign page from this address.`,
      ``,
      `If that was you, confirm it here:`,
      params.confirmLink,
      ``,
      `Confirming replaces your old link with a new one; the old one stops working right after. This mail alone changes nothing: if you did not ask for this, ignore it and your existing link keeps working exactly as it does now.`,
      ``,
      `The link above expires in 30 minutes and works once.`,
    ].join("\n"),
    html: layout({
      preheader: "Confirm it was you, and this mail alone changes nothing.",
      heading: `${name}, was this you?`,
      body: [
        p(
          "Somebody asked to get back into your Monica campaign page from this address. If that was you, confirm it below.",
        ),
        quiet(
          "Confirming replaces your old link with a new one; the old one stops working right after you click. Requesting this mail changes nothing on its own: if you did not ask for this, ignore it and your existing link keeps working exactly as it does now.",
        ),
        quiet("This link expires in 30 minutes and works once."),
      ].join(""),
      action: { label: "Confirm it was me", href: params.confirmLink },
    }),
  };
}

/**
 * A creator asked for their handle to be corrected.
 *
 * Sent to the team, not the creator: a request that sits unseen is a creator
 * stuck for days, because their submissions keep being refused against the
 * old handle until somebody decides. The console shows the queue; this is
 * what makes somebody open the console.
 */
export function handleRequestFiledEmail(params: {
  to: string;
  creatorName: string;
  platform: string;
  oldHandle: string;
  requestedHandle: string;
  reason: string;
  consoleUrl: string;
}): Email {
  const line = `${params.creatorName} asked to change their ${params.platform} handle from @${params.oldHandle} to @${params.requestedHandle}.`;

  return {
    to: params.to,
    toName: "Blockfest campaign team",
    replyTo: CONTACT_EMAIL,
    subject: `Handle correction requested: @${params.oldHandle} to @${params.requestedHandle}`,
    text: [
      line,
      ``,
      `Their reason: ${params.reason}`,
      ``,
      `Until somebody decides, their entries keep being checked against @${params.oldHandle}.`,
      ``,
      `Decide it here: ${params.consoleUrl}`,
    ].join("\n"),
    html: layout({
      preheader: line,
      heading: "A handle correction is waiting",
      body: [
        p(escape(line)),
        boxed("Their reason", params.reason),
        quiet(
          `Until somebody decides, their entries keep being checked against @${escape(params.oldHandle)}.`,
        ),
      ].join(""),
      action: { label: "Open the request", href: params.consoleUrl },
    }),
  };
}

/**
 * The decision on a handle request, either way.
 *
 * Approved is an unblocking: the thing to do next is resubmit, so the mail
 * says so. Rejected carries the admin's note verbatim, because the note is
 * the decision and paraphrasing it would put words in the reviewer's mouth.
 */
export function handleRequestDecidedEmail(params: {
  to: string;
  fullName: string;
  platform: string;
  oldHandle: string;
  requestedHandle: string;
  approved: boolean;
  /** Required on a rejection; the database refuses to record one without it. */
  decisionNote: string | null;
  personalPage: string;
}): Email {
  const name = firstName(params.fullName);

  if (params.approved) {
    const line = `Your ${params.platform} handle is now @${params.requestedHandle}.`;
    return {
      to: params.to,
      toName: params.fullName,
      replyTo: CONTACT_EMAIL,
      subject: `Fixed: your ${params.platform} handle is now @${params.requestedHandle}`,
      text: [
        `${name}, the correction you asked for has been made. ${line}`,
        ``,
        `If an entry of yours was refused because of the old handle, submit it again now: it is checked against the corrected one.`,
        ``,
        `Your page: ${params.personalPage}`,
      ].join("\n"),
      html: layout({
        preheader: line,
        heading: `Fixed, ${name}`,
        body: [
          p(escape(line)),
          p(
            "If an entry of yours was refused because of the old handle, submit it again now: it is checked against the corrected one.",
          ),
        ].join(""),
        action: { label: "Submit your entry", href: params.personalPage },
      }),
    };
  }

  const note = params.decisionNote ?? "";
  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: `About your ${params.platform} handle request`,
    text: [
      `${name}, the change you asked for, @${params.oldHandle} to @${params.requestedHandle}, was not applied.`,
      ``,
      `The reviewer wrote: ${note}`,
      ``,
      `You can send a new request from your page if this does not settle it.`,
      ``,
      `Your page: ${params.personalPage}`,
    ].join("\n"),
    html: layout({
      preheader: `The change to @${params.requestedHandle} was not applied.`,
      heading: `About your request, ${name}`,
      body: [
        p(
          `The change you asked for, @${escape(params.oldHandle)} to @${escape(params.requestedHandle)}, was not applied.`,
        ),
        boxed("The reviewer wrote", note),
        p(
          "You can send a new request from your page if this does not settle it.",
        ),
      ].join(""),
      action: { label: "Open your page", href: params.personalPage },
    }),
  };
}

/**
 * The team corrected a handle directly, without a request.
 *
 * Sent because the registration changed under the creator, and a change to
 * what their entries are checked against is a change they must be able to
 * dispute. Silence here is how a wrong correction goes unnoticed until an
 * entry is refused for reasons the creator cannot see.
 */
export function handleCorrectedEmail(params: {
  to: string;
  fullName: string;
  platform: string;
  oldHandle: string;
  newHandle: string;
  personalPage: string;
}): Email {
  const name = firstName(params.fullName);
  const line = `Your ${params.platform} handle was corrected from @${params.oldHandle} to @${params.newHandle}.`;

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: `Your ${params.platform} handle is now @${params.newHandle}`,
    text: [
      `${name}, ${line}`,
      ``,
      `Entries you submit are checked against the corrected handle from now on.`,
      ``,
      `If this is not right, reply to this email and we will look at it.`,
      ``,
      `Your page: ${params.personalPage}`,
    ].join("\n"),
    html: layout({
      preheader: line,
      heading: `A correction, ${name}`,
      body: [
        p(escape(line)),
        p("Entries you submit are checked against the corrected handle from now on."),
        quiet("If this is not right, reply to this email and we will look at it."),
      ].join(""),
      action: { label: "Open your page", href: params.personalPage },
    }),
  };
}

/**
 * You won.
 *
 * Sent when a winner is PUBLISHED, never for a draft, because a draft can be
 * changed and an email cannot. Names the amount and how it is paid, since
 * "how do I get it" is the reply every winner otherwise sends.
 */
export function winnerEmail(params: {
  to: string;
  fullName: string;
  weekNo: number;
  categoryLabel: string;
  prizeNaira: number;
  personalPage: string;
}): Email {
  const name = firstName(params.fullName);
  const amount = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(params.prizeNaira);
  const line = `You are ${params.categoryLabel} for week ${params.weekNo}.`;

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: `You won: ${params.categoryLabel}, week ${params.weekNo}`,
    text: [
      `${name}, ${line}`,
      ``,
      `The prize is ${amount}. It is paid to the Monica tag you gave when you registered, so check on your page that the tag is right.`,
      ``,
      `Your page: ${params.personalPage}`,
    ].join("\n"),
    html: layout({
      preheader: `${line} The prize is ${amount}.`,
      heading: `You won, ${name}`,
      body: [
        p(escape(line)),
        boxed("The prize", amount),
        p(
          "It is paid to the Monica tag you gave when you registered, so check on your page that the tag is right.",
        ),
      ].join(""),
      action: { label: "Check your Monica tag", href: params.personalPage },
    }),
  };
}

/**
 * The voting code.
 *
 * Sent to anyone who casts a Community Favourite vote, which means the
 * recipient may have typed somebody else's address, so the last line says
 * plainly that ignoring the mail leaves nothing counted. The code leads and
 * is set large: this message is read in a notification shade with an input
 * waiting in the other tab, and everything after the six digits is context.
 *
 * Names the nominee it confirms, because the code is bound to the cast: a
 * voter who changed their mind and cast again holds a mail whose code is
 * dead, and the name is how they tell the two mails apart.
 */
export function voteVerificationEmail(params: {
  to: string;
  code: string;
  nomineeName: string;
  weekNo: number;
}): Email {
  const confirms = `It confirms your Community Favourite vote for ${params.nomineeName}, week ${params.weekNo}.`;

  return {
    to: params.to,
    replyTo: CONTACT_EMAIL,
    subject: `Your voting code: ${params.code}`,
    text: [
      `Your code: ${params.code}`,
      ``,
      confirms,
      ``,
      `Enter it on the winners page within 15 minutes. After that it expires, and you can cast your vote again for a fresh one.`,
      `One vote per email address each round.`,
      ``,
      `If you did not vote in Monica: The Money Story, ignore this email and nothing is counted.`,
    ].join("\n"),
    html: layout({
      preheader: confirms,
      heading: "Your voting code",
      body: [
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;">
           <tr><td align="center" style="padding:18px 16px;background:#f7f8fa;border:1px solid ${LINE};border-radius:10px;">
             <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:34px;line-height:1.2;font-weight:700;letter-spacing:8px;color:${INK};">${escape(params.code)}</p>
           </td></tr>
         </table>`,
        p(escape(confirms)),
        p(
          "Enter it on the winners page within <strong>15 minutes</strong>. After that it expires, and you can cast your vote again for a fresh one.",
        ),
        quiet("One vote per email address each round."),
        quiet(
          "If you did not vote in Monica: The Money Story, ignore this email and nothing is counted.",
        ),
      ].join(""),
    }),
  };
}

/**
 * An entry, received.
 *
 * The submission form says "we got it" on screen and the decision arrives by
 * mail, which left a gap the owner named: everything a creator does that they
 * then wait on should leave a trail in their inbox. This is the trail for the
 * wait itself. It echoes the link back, because the commonest submission
 * mistake is pasting the wrong one, and the moment to notice is now, while
 * the week is still open, not on Friday in a rejection.
 */
export function submissionReceivedEmail(params: {
  to: string;
  fullName: string;
  weekNo: number;
  platformLabel: string;
  url: string;
  personalPage: string;
}): Email {
  const name = firstName(params.fullName);

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: `We got it: your week ${params.weekNo} entry`,
    text: [
      `${name}, your week ${params.weekNo} entry on ${params.platformLabel} is in.`,
      ``,
      `What you submitted:`,
      params.url,
      ``,
      `A person reviews every entry by hand. You will get an email either way: the points if it is approved, the reason if it is not.`,
      `If that link is not the post you meant, submit the right one before the week closes and tell us by replying here.`,
      ``,
      `Your page: ${params.personalPage}`,
    ].join("\n"),
    html: layout({
      preheader: `Your week ${params.weekNo} entry on ${params.platformLabel} is in. A person reviews it by hand.`,
      heading: `We got it, ${name}`,
      body: [
        p(
          `Your week ${params.weekNo} entry on ${escape(params.platformLabel)} is in.`,
        ),
        boxed("What you submitted", params.url),
        p(
          "A person reviews every entry by hand. You will get an email either way: the points if it is approved, the reason if it is not.",
        ),
        quiet(
          "If that link is not the post you meant, submit the right one before the week closes and tell us by replying here.",
        ),
      ].join(""),
      action: { label: "See your entries", href: params.personalPage },
    }),
  };
}

/**
 * A vote, recorded.
 *
 * Sent after the code verifies, to the address as typed. One template with no
 * status parameter at all, and that absence is the security property: a held
 * vote must be indistinguishable from a counted one in the voter's inbox,
 * exactly as it is on screen, or the mail becomes a progress report for
 * whoever is tuning a farm against the cap. Nothing here may ever say
 * counted, held, reviewed, or anything a status could vary.
 */
export function voteReceiptEmail(params: {
  to: string;
  nomineeName: string;
  weekNo: number;
}): Email {
  const line = `Your Community Favourite vote for ${params.nomineeName} is in for week ${params.weekNo}.`;

  return {
    to: params.to,
    replyTo: CONTACT_EMAIL,
    subject: "Your vote is in",
    text: [
      line,
      ``,
      `The result is announced on Sunday evening, Lagos time, on the winners page:`,
      votingPage(),
      ``,
      `Thank you for taking a minute to vote.`,
    ].join("\n"),
    html: layout({
      preheader: line,
      heading: "Your vote is in",
      body: [
        p(escape(line)),
        p(
          "The result is announced on Sunday evening, Lagos time, on the winners page.",
        ),
        quiet("Thank you for taking a minute to vote."),
      ].join(""),
      action: { label: "See the shortlist", href: votingPage() },
    }),
  };
}

/**
 * You are on the ballot.
 *
 * Being placed on a public shortlist is a thing that happens TO a creator,
 * and the vote is also theirs to campaign in: the rules allow asking your
 * audience to vote, and every vote is email-verified, so telling nominees
 * the moment the round opens is what makes the vote a real contest rather
 * than a page their followers never hear about.
 */
export function shortlistEmail(params: {
  to: string;
  fullName: string;
  weekNo: number;
  /** Already formatted for Lagos, e.g. "Sunday 6:00 pm". */
  closesAtLagos: string;
  /** Set when the round is staged ahead: the window has not opened yet. A
      round opened for a future morning must not mail "open now" tonight. */
  opensAtLagos?: string;
  votingUrl: string;
}): Email {
  const name = firstName(params.fullName);
  const window = params.opensAtLagos
    ? `The public vote opens ${params.opensAtLagos} and closes ${params.closesAtLagos}, Lagos time.`
    : `The public vote is open now and closes ${params.closesAtLagos}, Lagos time.`;

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: `You are on the week ${params.weekNo} ballot`,
    text: [
      `${name}, your week ${params.weekNo} entry is on the Community Favourite shortlist.`,
      ``,
      `${window} The winner takes the Community Favourite prize.`,
      ``,
      `Share the voting page with your audience. Every vote is verified by email, one per address:`,
      params.votingUrl,
    ].join("\n"),
    html: layout({
      preheader: `Your entry is on the Community Favourite shortlist. Voting closes ${params.closesAtLagos}.`,
      heading: `You are on the ballot, ${name}`,
      body: [
        p(
          `Your week ${params.weekNo} entry is on the Community Favourite shortlist. ${escape(window)}`,
        ),
        p(
          "Share the voting page with your audience. Every vote is verified by email, one per address, so the push you make is the push that counts.",
        ),
      ].join(""),
      action: { label: "Open the voting page", href: params.votingUrl },
    }),
  };
}

/**
 * The result, to the nominees who did not win.
 *
 * The winner gets the winner email; everybody else on the ballot finds out
 * from the public page or from silence, and silence after being asked to
 * campaign is a door slammed. Two sentences: the result, and that being
 * shortlisted was itself the achievement the next week builds on.
 */
export function nomineeResultEmail(params: {
  to: string;
  fullName: string;
  weekNo: number;
  winnerName: string;
  votingUrl: string;
}): Email {
  const name = firstName(params.fullName);

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: `Week ${params.weekNo}: the Community Favourite result`,
    text: [
      `${name}, the week ${params.weekNo} Community Favourite vote has closed. It went to ${params.winnerName}.`,
      ``,
      `Being on the shortlist put your work in front of every voter, and next week is a fresh ballot. Keep going.`,
      ``,
      `The results: ${params.votingUrl}`,
    ].join("\n"),
    html: layout({
      preheader: `The week ${params.weekNo} vote went to ${params.winnerName}.`,
      heading: `The week ${params.weekNo} result`,
      body: [
        p(
          `The Community Favourite vote has closed, and it went to <strong>${escape(params.winnerName)}</strong>.`,
        ),
        p(
          "Being on the shortlist put your work in front of every voter, and next week is a fresh ballot. Keep going.",
        ),
      ].join(""),
      action: { label: "See the results", href: params.votingUrl },
    }),
  };
}

/**
 * Points moved by hand.
 *
 * Every manual award or correction lands in the ledger with a note, and the
 * note used to be readable only by a creator who thought to scroll their own
 * history. A total that decides money moved silently is a dispute; the same
 * movement announced, with the reason attached, is bookkeeping. One template
 * for both directions, because the difference is the sign, not the honesty.
 */
export function awardEmail(params: {
  to: string;
  fullName: string;
  /** The human label for the source, e.g. "Featured by Blockfest". */
  sourceLabel: string;
  /** Signed: negative is a correction. */
  points: number;
  note: string;
  pointsTotal: number;
  personalPage: string;
}): Email {
  const name = firstName(params.fullName);
  const gained = params.points > 0;
  const moved = gained
    ? `You earned ${params.points} bonus points: ${params.sourceLabel}.`
    : `Your points were adjusted by ${params.points}: ${params.sourceLabel}.`;

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: gained
      ? `+${params.points} points: ${params.sourceLabel}`
      : `Your points were adjusted: ${params.sourceLabel}`,
    text: [
      `${name}, ${moved}`,
      ``,
      `The note from the team: ${params.note}`,
      ``,
      `Your total is now ${params.pointsTotal} points.`,
      ``,
      `Your page shows every movement: ${params.personalPage}`,
      `If this looks wrong, reply from this address and a person looks into it.`,
    ].join("\n"),
    html: layout({
      preheader: `${moved} Your total is now ${params.pointsTotal}.`,
      heading: gained ? `+${params.points} points, ${name}` : `Your points changed, ${name}`,
      body: [
        p(escape(moved)),
        boxed("The note from the team", params.note),
        boxed("Your points", `${params.pointsTotal}`),
        quiet(
          "Your page shows every movement. If this looks wrong, reply from this address and a person looks into it.",
        ),
      ].join(""),
      action: { label: "See your history", href: params.personalPage },
    }),
  };
}

/**
 * An entry, re-scored.
 *
 * Repricing exists for the day a point rule was wrong and an entry was paid
 * under it. The engine records before and after with a reason; a creator
 * whose number changed under them deserves the same three facts, because a
 * total that moves silently in either direction reads as a glitch, and a
 * glitch in the thing that decides money reads as worse.
 */
export function repriceEmail(params: {
  to: string;
  fullName: string;
  weekNo: number;
  before: number;
  after: number;
  reason: string;
  personalPage: string;
}): Email {
  const name = firstName(params.fullName);
  const line = `Your week ${params.weekNo} entry was re-scored from ${params.before} to ${params.after} points.`;

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: `Your week ${params.weekNo} entry was re-scored`,
    text: [
      `${name}, ${line}`,
      ``,
      `Why: ${params.reason}`,
      ``,
      `Your page shows the movement in your history: ${params.personalPage}`,
      `If this looks wrong, reply from this address and a person looks into it.`,
    ].join("\n"),
    html: layout({
      preheader: line,
      heading: `Re-scored: week ${params.weekNo}`,
      body: [
        p(escape(line)),
        boxed("Why", params.reason),
        quiet(
          "Your page shows the movement in your history. If this looks wrong, reply from this address and a person looks into it.",
        ),
      ].join(""),
      action: { label: "See your history", href: params.personalPage },
    }),
  };
}

/**
 * A handle-change request, acknowledged.
 *
 * The decision email always follows, but the gap between filing and deciding
 * is exactly when a creator retries the refused entry and concludes the
 * campaign is broken. One mail that says hold that platform's entry converts
 * days of silent bouncing into a wait with a shape.
 */
export function handleFixAckEmail(params: {
  to: string;
  fullName: string;
  platformLabel: string;
  oldHandle: string;
  requestedHandle: string;
  personalPage: string;
}): Email {
  const name = firstName(params.fullName);

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: `We got your handle change request`,
    text: [
      `${name}, we got your request to change your ${params.platformLabel} handle from @${params.oldHandle} to @${params.requestedHandle}.`,
      ``,
      `A person reviews it by hand and you will get an email with the decision.`,
      `Until it is decided, entries on ${params.platformLabel} are still checked against @${params.oldHandle}, so hold that platform's entry rather than resubmitting into refusals.`,
      ``,
      `Your page: ${params.personalPage}`,
    ].join("\n"),
    html: layout({
      preheader: `Change @${params.oldHandle} to @${params.requestedHandle} on ${params.platformLabel}: received.`,
      heading: `We got it, ${name}`,
      body: [
        p(
          `Your request to change your ${escape(params.platformLabel)} handle from <strong>@${escape(params.oldHandle)}</strong> to <strong>@${escape(params.requestedHandle)}</strong> is filed. A person reviews it by hand and you will get an email with the decision.`,
        ),
        quiet(
          `Until it is decided, entries on ${escape(params.platformLabel)} are still checked against the old handle, so hold that platform's entry rather than resubmitting into refusals.`,
        ),
      ].join(""),
      action: { label: "Back to your page", href: params.personalPage },
    }),
  };
}

/**
 * A new stage is live.
 *
 * The one email the campaign promised and never had. Every other template
 * here is reactive: it fires because a creator did something, or because
 * an admin did something to them. Nothing fired because the CAMPAIGN
 * moved, so "a new challenge drops with every stage" was delivered by no
 * channel at all, and four Mondays of retention rested on people
 * remembering to open a bookmarked link.
 *
 * Links the page, NOT a personal link, and that is a constraint rather
 * than a choice: only a hash of each creator's token is stored, so no
 * bulk sender can rebuild one. Which is the right answer anyway. A
 * signed-in creator lands on their page; anybody else meets the locked
 * screen, which already offers a way back. It also means this, the only
 * mail the campaign sends to everybody at once, carries no credential.
 *
 * The brief is the admin's own words from the console, not a registry
 * copy, so it cannot go stale beside what the landing page shows.
 */
export function challengeLiveEmail(params: {
  to: string;
  fullName: string;
  weekNo: number;
  title: string;
  /** The question line, when the console has one. */
  question?: string | null;
  /** The brief as written in the console. Trimmed to a readable opening;
      the full text lives on the page the button opens. */
  brief: string;
  basePoints: number;
  /** Already formatted for Lagos, e.g. "Saturday, 3 October, 12:00 pm". */
  closesAtLagos: string;
  /** The tokenless page. See the note above on why it is not a link. */
  pageUrl: string;
}): Email {
  const name = firstName(params.fullName);
  const opening = params.brief.trim().split(/\n{2,}/)[0]?.slice(0, 400) ?? "";
  const headline = params.question?.trim() || params.title;

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: `Stage ${params.weekNo} is live: ${params.title}`,
    text: [
      `${name}, stage ${params.weekNo} is open.`,
      ``,
      `${params.title}: ${headline}`,
      ``,
      opening,
      ``,
      `Worth ${params.basePoints} points for completing it, and more for posting the same piece on more than one platform.`,
      `Submissions close ${params.closesAtLagos}, Lagos time.`,
      ``,
      `Publish on your own account, then paste the link on your page:`,
      params.pageUrl,
    ].join("\n"),
    html: layout({
      preheader: `${params.title}. Closes ${params.closesAtLagos}, Lagos time.`,
      heading: `Stage ${params.weekNo} is live, ${name}`,
      body: [
        p(`<strong>${escape(params.title)}</strong>`),
        p(escape(headline)),
        opening ? p(escape(opening)) : "",
        boxed("Closes", `${params.closesAtLagos}, Lagos time`),
        p(
          `Worth <strong>${params.basePoints} points</strong> for completing it, and more for posting the same piece on more than one platform.`,
        ),
        quiet(
          "Publish on your own account first, then paste the link on your page. If the button asks who you are, open the link from your welcome email once and it will remember you.",
        ),
      ].join(""),
      action: { label: "Open your page and submit", href: params.pageUrl },
    }),
  };
}

/**
 * Removed from the campaign.
 *
 * The one decision in this system that took something away and told
 * nobody. void_enrolment has always written a perfect audit row with a
 * mandatory reason, and the route's own comment says that reason "is what
 * makes a disqualification answerable later" — it was answerable to
 * admins and to nobody else. A creator found out by filming a week's
 * work, publishing it to three platforms, pasting the link, and meeting a
 * refusal that named a support address but never the reason.
 *
 * The reason is quoted rather than paraphrased, the way a rejection note
 * is, because it is the thing being appealed. No evidence detail: the
 * decision and the appeal path, so the notice cannot be used to tune a
 * second attempt.
 */
export function disqualifiedEmail(params: {
  to: string;
  fullName: string;
  reason: string;
  pointsReversed: number;
  personalPage: string;
}): Email {
  const name = firstName(params.fullName);
  const points =
    params.pointsReversed > 0
      ? `The ${params.pointsReversed} points those entries had earned have been reversed.`
      : "";

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: "Your place in the Monica campaign has been removed",
    text: [
      `${name}, your entry in Monica: The Money Story has been removed and your work is no longer being scored.`,
      ``,
      `The reason recorded: ${params.reason}`,
      ``,
      points,
      ``,
      `If you believe this is wrong, reply to this email from this address and a person will look at it. Please do not keep submitting in the meantime; entries are refused while this stands.`,
    ]
      .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
      .join("\n"),
    html: layout({
      preheader: "Your entries are no longer being scored. The reason is inside.",
      heading: `${name}, your place has been removed`,
      body: [
        p(
          "Your entry in Monica: The Money Story has been removed, and your work is no longer being scored.",
        ),
        boxed("The reason recorded", params.reason),
        points ? p(escape(points)) : "",
        p(
          "If you believe this is wrong, reply to this email from this address and a person will look at it.",
        ),
        quiet(
          "Please do not keep submitting in the meantime. Entries are refused while this stands, so the work would not be scored.",
        ),
      ].join(""),
      action: { label: "Your campaign page", href: params.personalPage },
    }),
  };
}

/**
 * Submissions are open again.
 *
 * The pause panel tells creators to "come back and paste your link when
 * this clears", which is an instruction to poll a page that gives no
 * signal. The people most harmed by that are the ones who obeyed it and
 * waited. Resuming is the campaign moving, so the campaign says so.
 */
export function resumedEmail(params: {
  to: string;
  fullName: string;
  /** When the open week closes, already formatted for Lagos. */
  closesAtLagos: string | null;
  personalPage: string;
}): Email {
  const name = firstName(params.fullName);
  const deadline = params.closesAtLagos
    ? `This week still closes ${params.closesAtLagos}, Lagos time.`
    : "";

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: "Submissions are open again",
    text: [
      `${name}, submissions are open again.`,
      ``,
      deadline,
      ``,
      `If you were waiting to send an entry, you can send it now: ${params.personalPage}`,
    ]
      .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
      .join("\n"),
    html: layout({
      preheader: "If you were waiting to send an entry, you can send it now.",
      heading: `Open again, ${name}`,
      body: [
        p("Submissions are open again."),
        deadline ? p(escape(deadline)) : "",
        quiet(
          "If you were holding an entry back while we paused, this is the moment to send it.",
        ),
      ].join(""),
      action: { label: "Send your entry", href: params.personalPage },
    }),
  };
}

/**
 * An entry was taken back.
 *
 * The withdrawal feature cuts both ways, and this is the half that makes
 * it safe. Before it existed, somebody holding a stolen personal link
 * could only ADD a submission, and submit_entry refuses a post that is
 * not from the registered handle, so the worst case was narrow. Being
 * able to REMOVE a pending entry is a new power, and in the wrong hands
 * it deletes a creator's real week quietly.
 *
 * So every withdrawal is announced, including the ones the creator did
 * themselves: a receipt nobody needed costs a glance, and a silent
 * deletion costs a week. It names the platform and the URL so the
 * creator can tell their own action from somebody else's at a glance,
 * and says what to do if it was not them.
 */
/**
 * Somebody you brought in got their first entry approved.
 *
 * The rules promise this in two places and the engine has paid it since
 * migration 0014, on the first approval of the creator you referred rather
 * than on their signup, which is the wording's whole point. Nothing ever
 * said so. A creator who shared their code watched their total move and
 * had to guess why, and the one mechanic that grows the campaign was the
 * only one that never spoke.
 *
 * Names the person, because "a referral was credited" is a receipt and
 * "Chidi's first entry was approved" is a reason to send the code to
 * somebody else.
 */
export function referralCreditEmail(params: {
  to: string;
  fullName: string;
  referredName: string;
  points: number;
  pointsTotal: number;
  referralCode: string;
  personalPage: string;
}): Email {
  const name = firstName(params.fullName);
  const who = firstName(params.referredName);
  const line = `${who} had their first entry approved, so your ${params.points} referral points are in. You are on ${params.pointsTotal}.`;

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: `You earned ${params.points} points: ${who} is in`,
    text: [
      `${name}, somebody you brought into the campaign just made it count.`,
      ``,
      line,
      ``,
      `Referral points land on a first approved entry, not on a signup, so this one is somebody who actually showed up and posted.`,
      ``,
      `Your referral code: ${params.referralCode}`,
      ``,
      `Your page: ${params.personalPage}`,
    ].join("\n"),
    html: layout({
      preheader: line,
      heading: `Nice one, ${name}`,
      body: [
        p(
          `Somebody you brought into the campaign just made it count. ${escape(who)} had their first entry approved.`,
        ),
        boxed("Your points", `${params.pointsTotal}`),
        p(escape(line)),
        quiet(
          "Referral points land on a first approved entry, not on a signup, so this is somebody who actually showed up and posted. Your code is " +
            escape(params.referralCode) +
            ".",
        ),
      ].join(""),
      action: { label: "See where you stand", href: params.personalPage },
    }),
  };
}

/**
 * A creator added a platform they did not register with.
 *
 * Sent for the same reason the withdrawal notice is: adding a handle is a
 * change to how work gets attributed, and the only person who must not be
 * surprised by it is the person it belongs to. If somebody else is holding
 * their link, this is the mail that says so.
 */
export function handleAddedEmail(params: {
  to: string;
  fullName: string;
  platformLabel: string;
  handle: string;
  personalPage: string;
}): Email {
  const name = firstName(params.fullName);
  const line = `You can now submit ${params.platformLabel} posts, and they count toward the same entry as the rest.`;

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: `${params.platformLabel} added to your account`,
    text: [
      `${name}, you added a ${params.platformLabel} handle: @${params.handle}`,
      ``,
      line,
      ``,
      `The same piece posted on more platforms is worth more, so if the work is already up there, send the link.`,
      ``,
      `Your page: ${params.personalPage}`,
      ``,
      `If this was not you, somebody else has your personal link. Get a new one straight away: it stops the old one working, and ends any session using it.`,
    ].join("\n"),
    html: layout({
      preheader: line,
      heading: `${escape(params.platformLabel)} added, ${name}`,
      body: [
        boxed(`Your ${escape(params.platformLabel)} handle`, `@${escape(params.handle)}`),
        p(escape(line)),
        p(
          "The same piece posted on more platforms is worth more, so if the work is already up there, send the link.",
        ),
        quiet(
          "If this was not you, somebody else has your personal link. Get a new one straight away: it stops the old one working, and ends any session using it.",
        ),
      ].join(""),
      action: { label: "Send a post", href: params.personalPage },
    }),
  };
}

export function withdrawnEmail(params: {
  to: string;
  fullName: string;
  platformLabel: string;
  weekNo: number;
  url: string;
  /** When the open week closes, formatted for Lagos. Null when no week is
      open, which changes the advice from "send another" to "you cannot". */
  closesAtLagos: string | null;
  personalPage: string;
  recoverUrl: string;
}): Email {
  const name = firstName(params.fullName);
  const line = `Your week ${params.weekNo} entry on ${params.platformLabel} was taken back before review.`;
  /*
   * The next step, and it has to be honest in both directions. A creator
   * who withdraws while the week is open can send another and should be
   * told the deadline; one who withdraws after it closed cannot, and
   * telling them to "send the right one" would be advice they cannot
   * follow, which is the exact bug that made this feature necessary.
   */
  const next = params.closesAtLagos
    ? `That platform is free again. Send your replacement before ${params.closesAtLagos}, Lagos time, or this week has no entry from you on ${params.platformLabel}.`
    : `No challenge is open right now, so this one cannot be replaced. The next stage is your next chance.`;

  return {
    to: params.to,
    toName: params.fullName,
    replyTo: CONTACT_EMAIL,
    subject: `Your week ${params.weekNo} entry was taken back`,
    text: [
      `${name}, ${line}`,
      ``,
      `The entry removed:`,
      params.url,
      ``,
      next,
      ``,
      `Your page: ${params.personalPage}`,
      ``,
      `If this was not you, somebody else has your personal link. Get a new one straight away, which stops the old one working: ${params.recoverUrl}`,
    ].join("\n"),
    html: layout({
      preheader: line,
      heading: `Taken back, ${name}`,
      body: [
        p(escape(line)),
        boxed("The entry removed", params.url),
        p(escape(next)),
        quiet(
          `If this was not you, somebody else has your personal link. Get a new one at ${escape(params.recoverUrl)} straight away: it stops the old one working, and ends any session using it.`,
        ),
      ].join(""),
      /* The page, not recovery: the common case by far is a creator who
         meant to do this and now needs to send another. The line above
         carries the "not me" path for the rare case. */
      action: { label: "Send a replacement", href: params.personalPage },
    }),
  };
}
