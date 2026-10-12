"use client";

import type { MouseEvent, Ref } from "react";
import { Check, Copy, Download, ImageDown, Share2 } from "lucide-react";
import { FaLinkedinIn, FaWhatsapp } from "react-icons/fa6";
import { buttonClass } from "@/components/shared/panel";
import { PLATFORM_ICON } from "@/components/shared/platform-icon";
import {
  BUTTON_LABEL,
  COPY,
  PLATFORMS,
  buttonsFor,
  marksClass,
  platformAction,
  statusAction,
  type ButtonId,
  type Platform,
  type ShareEnv,
} from "../lib/share";

/**
 * What the page is waiting on: the full picture for a share (prepare) or a
 * download, or the phone's share list being open (sheet). `by` is the
 * control that started it, which alone says "Preparing…" or "Saving…".
 */
export interface Busy {
  kind: "prepare" | "sheet" | "download";
  by: ButtonId | Platform | "status";
}

/** PLATFORM_ICON is the campaign's three; the DP adds LinkedIn and WhatsApp here. */
const MARK_ICON: Record<Platform, typeof FaLinkedinIn> = {
  x: PLATFORM_ICON.x,
  instagram: PLATFORM_ICON.instagram,
  tiktok: PLATFORM_ICON.tiktok,
  linkedin: FaLinkedinIn,
  whatsapp: FaWhatsapp,
};

const BUTTON_ICON: Record<ButtonId, typeof Share2> = {
  share: Share2,
  photos: ImageDown,
  download: Download,
  save: ImageDown,
  more: Share2,
};

const ROW = "border-t border-line px-5 py-4 sm:px-6";

/** The label a control shows while the page works on what it started. */
function busyLabel(busy: Busy | null, by: Busy["by"], idle: string): string {
  if (busy?.by !== by) return idle;
  if (busy.kind === "prepare") return COPY.preparing;
  if (busy.kind === "download") return COPY.saving;
  return idle;
}

/**
 * The picture card's save and share rows: the buttons this device gets, the
 * status line, WhatsApp Status on a phone, the "Post it on" marks and the
 * caption with Copy.
 *
 * Presentational only. Every navigator call is DPGenerator's, so a tap here
 * reaches navigator.share inside the same gesture.
 */
export default function ShareActions({
  env,
  ready,
  busy,
  status,
  statusFile,
  profile,
  tip,
  pressed,
  caption,
  fileName,
  captionState,
  primaryRef,
  onButton,
  onMark,
  onStatus,
  onCopyCaption,
}: {
  env: ShareEnv;
  ready: boolean;
  busy: Busy | null;
  /** The live state, or the notice from the last action. */
  status: string;
  /** Said beside the state, outside the live region, so typing is not read out letter by letter. */
  statusFile?: string;
  /** Once ready: how to make it a profile picture. */
  profile: string | null;
  tip: string | null;
  pressed: Platform | null;
  caption: string;
  fileName: string;
  captionState: "idle" | "copied" | "failed";
  primaryRef: Ref<HTMLButtonElement>;
  onButton: (id: ButtonId) => void;
  onMark: (p: Platform, e: MouseEvent<HTMLElement>) => void;
  onStatus: () => void;
  onCopyCaption: () => void;
}) {
  const shut = !ready || busy !== null;
  const whatsappStatus = statusAction(env);

  return (
    <>
      <div className={ROW}>
        <div className="flex flex-wrap gap-3">
          {buttonsFor(env).map(({ id, intent }, i) => {
            const Icon = BUTTON_ICON[id];
            return (
              <button
                key={id}
                ref={i === 0 ? primaryRef : undefined}
                type="button"
                className={buttonClass(intent, "w-full sm:w-auto")}
                disabled={shut}
                onClick={() => onButton(id)}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {busyLabel(busy, id, BUTTON_LABEL[id])}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-ink-3 [overflow-wrap:anywhere]">
          <span id="dp-status" aria-live="polite">
            {status}
          </span>
          {statusFile && <span>: {statusFile}</span>}
        </p>
        {profile && <p className="mt-2 text-sm text-ink-3">{profile}</p>}
      </div>

      {whatsappStatus && (
        <div className={ROW}>
          <button
            type="button"
            className={buttonClass("secondary", "w-full sm:w-auto")}
            disabled={shut}
            aria-describedby="dp-whatsapp-status-how"
            onClick={onStatus}
          >
            <FaWhatsapp className="h-4 w-4" aria-hidden="true" />
            {busyLabel(busy, "status", COPY.statusLabel)}
          </button>
          <p id="dp-whatsapp-status-how" className="mt-3 text-sm text-ink-3">
            {whatsappStatus.how}
          </p>
        </div>
      )}

      <div className={ROW}>
        <p id="dp-post-label" className="text-sm font-semibold text-white">
          {COPY.postLabel}
        </p>
        <ul aria-labelledby="dp-post-label" className="mt-1 -ml-1 flex flex-wrap">
          {PLATFORMS.map((p) => {
            const action = platformAction(p, env, caption, fileName);
            const Icon = MARK_ICON[p];
            const on = pressed === p;
            const target = `inline-flex h-11 w-11 items-center justify-center rounded-full ${
              shut ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            }`;
            const chip = (
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-150 ${
                  on ? "border-line-3 bg-card-3 text-white" : "border-line-2 text-ink-2"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            );
            const click = (e: MouseEvent<HTMLElement>) => {
              if (shut) {
                e.preventDefault();
                return;
              }
              onMark(p, e);
            };
            return (
              <li key={p}>
                {action.kind === "link" ? (
                  <a
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={COPY.markLabel(p)}
                    aria-disabled={shut}
                    className={target}
                    onClick={click}
                  >
                    {chip}
                  </a>
                ) : (
                  <button
                    type="button"
                    aria-label={COPY.markLabel(p)}
                    aria-pressed={on}
                    aria-disabled={shut}
                    className={target}
                    onClick={click}
                  >
                    {chip}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-1 text-sm text-ink-3">{COPY.marksDo(marksClass(env), env.captionTravels)}</p>
        <p aria-live="polite" className={tip ? "mt-2 text-sm text-ink-2" : "sr-only"}>
          {tip}
        </p>
      </div>

      <div className={ROW}>
        <p id="dp-caption-label" className="text-sm font-semibold text-white">
          {COPY.captionLabel}
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
          <p
            id="dp-caption"
            className="w-full min-w-0 select-all text-sm leading-relaxed text-ink-2 [overflow-wrap:anywhere] sm:flex-1"
          >
            {caption}
          </p>
          <button
            type="button"
            aria-describedby="dp-caption-label"
            className={buttonClass("secondary", "min-w-24 self-start")}
            onClick={onCopyCaption}
          >
            {captionState === "copied" ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {captionState === "copied" ? COPY.copied : COPY.copy}
          </button>
        </div>
        <p aria-live="polite" className={captionState === "failed" ? "mt-2 text-sm text-ink-2" : "sr-only"}>
          {captionState === "failed" ? COPY.copyFailed : captionState === "copied" ? COPY.copied : ""}
        </p>
      </div>
    </>
  );
}
