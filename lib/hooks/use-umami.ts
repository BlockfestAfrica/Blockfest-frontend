"use client";

import { useCallback } from "react";
import { umamiTrack, umamiIdentify } from "../analytics";

export const useUmami = () => {
  const track = useCallback((event: string, data?: Record<string, unknown>) => {
    umamiTrack(event, data);
  }, []);

  const identify = useCallback((data: Record<string, unknown>) => {
    umamiIdentify(data);
  }, []);

  // Common event tracking functions
  const trackButtonClick = useCallback(
    (buttonName: string, location?: string) => {
      track("button-click", { buttonName, location });
    },
    [track]
  );

  const trackPageView = useCallback(
    (pageName: string, category?: string) => {
      track("page-view", { pageName, category });
    },
    [track]
  );

  const trackFormSubmit = useCallback(
    (formName: string, success?: boolean) => {
      track("form-submit", { formName, success });
    },
    [track]
  );

  const trackDownload = useCallback(
    (fileName: string, fileType?: string) => {
      track("download", { fileName, fileType });
    },
    [track]
  );

  const trackError = useCallback(
    (errorMessage: string, errorType?: string) => {
      track("error", { errorMessage, errorType });
    },
    [track]
  );

  const trackRegistration = useCallback(
    (method?: string) => {
      track("registration-attempt", { method });
    },
    [track]
  );

  const trackSponsorClick = useCallback(
    (sponsorName: string, tier?: string) => {
      track("sponsor-click", { sponsorName, tier });
    },
    [track]
  );

  const trackSpeakerView = useCallback(
    (speakerName?: string) => {
      track("speaker-view", { speakerName });
    },
    [track]
  );

  return {
    track,
    identify,
    trackButtonClick,
    trackPageView,
    trackFormSubmit,
    trackDownload,
    trackError,
    trackRegistration,
    trackSponsorClick,
    trackSpeakerView,
  };
};
