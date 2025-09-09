/**
 * Umami Analytics Event Types
 * Define common event structures for consistent tracking
 */

export interface BaseEvent {
  timestamp?: number;
  sessionId?: string;
  userId?: string;
}

export interface ButtonClickEvent extends BaseEvent {
  buttonName: string;
  location: string;
  variant?: string;
}

export interface PageViewEvent extends BaseEvent {
  pageName: string;
  category?: string;
  referrer?: string;
}

export interface FormEvent extends BaseEvent {
  formName: string;
  success: boolean;
  errorMessage?: string;
  fields?: string[];
}

export interface RegistrationEvent extends BaseEvent {
  method: string;
  step?: string;
  source?: string;
}

export interface SponsorEvent extends BaseEvent {
  sponsorName: string;
  tier?: "platinum" | "gold" | "silver" | "bronze" | "community" | "media";
  action: "view" | "click" | "contact";
}

export interface SpeakerEvent extends BaseEvent {
  speakerName?: string;
  action: "view" | "click" | "bio-expand";
}

export interface ErrorEvent extends BaseEvent {
  errorMessage: string;
  errorType: "javascript" | "network" | "user" | "system";
  stack?: string;
  url?: string;
}

export interface DownloadEvent extends BaseEvent {
  fileName: string;
  fileType: string;
  fileSize?: number;
}

export interface VideoEvent extends BaseEvent {
  videoTitle: string;
  action: "play" | "pause" | "complete" | "seek";
  duration?: number;
  position?: number;
}

export interface ScrollEvent extends BaseEvent {
  depth: number;
  section?: string;
}

/**
 * Common event data structures for the Blockfest application
 */
export const EventTypes = {
  // Navigation
  BUTTON_CLICK: "button-click",
  PAGE_VIEW: "page-view",

  // User Actions
  REGISTRATION_ATTEMPT: "registration-attempt",
  FORM_SUBMIT: "form-submit",
  DOWNLOAD: "download",

  // Content Interaction
  SPEAKER_VIEW: "speaker-view",
  SPONSOR_CLICK: "sponsor-click",
  VIDEO_INTERACTION: "video-interaction",
  SCROLL_DEPTH: "scroll-depth",

  // System
  ERROR: "error",
  PERFORMANCE: "performance",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];
