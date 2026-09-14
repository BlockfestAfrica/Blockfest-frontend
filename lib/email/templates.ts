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
      ``,
      `Your referral code: ${params.referralCode}`,
      `You earn 10 points when somebody who joins with your code gets their first entry approved.`,
      ``,
      `A new challenge opens every Monday. Publish your answer on your own account, then paste the link on your page.`,
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
          "That link is your sign in and it does not expire. Anybody who opens it is you, so do not post it anywhere public or forward this email. If you lose it, reply from the address you registered with and we will issue a new one, which stops the old one working. If you did not register for this, reply and tell us.",
        ),
        boxed("Your referral code", params.referralCode),
        p(
          "You earn <strong>10 points</strong> when a creator who joins with your code gets their first entry approved. Not when they register, when their work is accepted.",
        ),
        p(
          "A new challenge opens every Monday. Publish your answer on your own account, then paste the link on your page.",
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
