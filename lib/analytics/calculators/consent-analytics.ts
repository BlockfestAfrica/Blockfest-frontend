/**
 * Consent analytics calculator
 */

import type { GuestRegistration, ConsentAnalytics } from "../types";

/**
 * Calculate consent analytics
 */
export function calculateConsentAnalytics(
  registrations: GuestRegistration[]
): ConsentAnalytics {
  const totalResponses = registrations.length;
  let photoConsentYes = 0;
  let photoConsentNo = 0;
  let emailConsentYes = 0;
  let emailConsentNo = 0;
  let xFollowed = 0;
  let telegramJoined = 0;

  registrations.forEach((reg) => {
    // Photo consent analysis
    const photoConsent = reg.photoConsent?.toLowerCase() || "";
    if (
      photoConsent.includes("yes") ||
      photoConsent.includes("done") ||
      photoConsent === "true"
    ) {
      photoConsentYes++;
    } else if (photoConsent.includes("no") || photoConsent === "false") {
      photoConsentNo++;
    }

    // Email consent analysis
    const emailConsent = reg.emailConsent?.toLowerCase() || "";
    if (
      emailConsent.includes("yes") ||
      emailConsent.includes("done") ||
      emailConsent === "true"
    ) {
      emailConsentYes++;
    } else if (emailConsent.includes("no") || emailConsent === "false") {
      emailConsentNo++;
    }

    // Social media engagement
    const xFollow = reg.xFollow?.toLowerCase() || "";
    if (
      xFollow.includes("done") ||
      xFollow.includes("yes") ||
      xFollow.includes("followed")
    ) {
      xFollowed++;
    }

    const telegramJoin = reg.telegramJoin?.toLowerCase() || "";
    if (
      telegramJoin.includes("done") ||
      telegramJoin.includes("yes") ||
      telegramJoin.includes("joined")
    ) {
      telegramJoined++;
    }
  });

  // Calculate percentages
  const photoPercentage =
    totalResponses > 0 ? Math.round((photoConsentYes / totalResponses) * 100) : 0;
  const emailPercentage =
    totalResponses > 0 ? Math.round((emailConsentYes / totalResponses) * 100) : 0;
  const xPercentage =
    totalResponses > 0 ? Math.round((xFollowed / totalResponses) * 100) : 0;
  const telegramPercentage =
    totalResponses > 0 ? Math.round((telegramJoined / totalResponses) * 100) : 0;

  // Overall compliance score
  const complianceScore = Math.round(
    (photoPercentage + emailPercentage + xPercentage + telegramPercentage) / 4
  );

  return {
    totalResponses,
    photoConsent: {
      yes: photoConsentYes,
      no: photoConsentNo,
      percentage: photoPercentage,
    },
    emailConsent: {
      yes: emailConsentYes,
      no: emailConsentNo,
      percentage: emailPercentage,
    },
    socialEngagement: {
      xFollowed,
      telegramJoined,
      xPercentage,
      telegramPercentage,
    },
    complianceScore,
  };
}
