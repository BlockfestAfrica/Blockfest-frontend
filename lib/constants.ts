// Shared constants - single source of truth for repeated values

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "partnership@blockfestafrica.com";

export const SOCIAL_HANDLES = {
  twitter: (
    process.env.NEXT_PUBLIC_TWITTER_HANDLE || "@blockfestafrica"
  ).replace("@", ""),
  instagram:
    process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE || "blockfestival_africa",
  youtube:
    process.env.NEXT_PUBLIC_YOUTUBE_CHANNEL || "@blockchainfestivalafrica",
  linkedin:
    process.env.NEXT_PUBLIC_LINKEDIN_PAGE || "company/blockfest-africa",
} as const;

export const SOCIAL_URLS = {
  twitter: `https://x.com/${SOCIAL_HANDLES.twitter}`,
  instagram: `https://www.instagram.com/${SOCIAL_HANDLES.instagram}`,
  youtube: `https://youtube.com/${SOCIAL_HANDLES.youtube}`,
  linkedin: `https://www.linkedin.com/${SOCIAL_HANDLES.linkedin}`,
  telegram: "https://t.me/blockf3stafrica",
} as const;

// Brand colors (matching @theme tokens in globals.css)
export const BRAND_COLORS = {
  gold: "#F2CB45",
  goldHover: "#e8bc3d",
  blue: "#1B64E4",
  blueDark: "#0D3B8C",
  blueDeep: "#031940",
  blueLight: "#3D7BE8",
  navGray: "#A4A4A4",
} as const;
