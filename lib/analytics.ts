// Umami Analytics configuration
export const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || "";
export const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC || "";

// Declare global umami interface
declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, unknown>) => void;
      identify: (data: Record<string, unknown>) => void;
    };
  }
}

// Umami Analytics functions
export const umamiTrack = (event: string, data?: Record<string, unknown>) => {
  if (typeof window !== "undefined" && window.umami) {
    window.umami.track(event, data);
  }
};

export const umamiIdentify = (data: Record<string, unknown>) => {
  if (typeof window !== "undefined" && window.umami) {
    window.umami.identify(data);
  }
};

// Main tracking function using only Umami
export const trackEvent = ({
  action,
  category,
  label,
  value,
  umamiEvent,
  umamiData = {},
}: {
  action: string;
  category: string;
  label?: string;
  value?: number;
  umamiEvent?: string;
  umamiData?: Record<string, unknown>;
}) => {
  // Track with Umami only
  if (umamiEvent) {
    umamiTrack(umamiEvent, umamiData);
  } else {
    umamiTrack(action, { category, label, value, ...umamiData });
  }
};

// Utility function to sanitize stack traces for production analytics
export function sanitizeStack(stack?: string | null): string | undefined {
  if (!stack) return undefined;
  // Drop query strings and hashes; cap length
  return stack
    .replace(/\?.*?(?=\s|$)/g, "")
    .replace(/#.*?(?=\s|$)/g, "")
    .slice(0, 4000);
}
