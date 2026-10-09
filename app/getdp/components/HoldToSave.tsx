"use client";

import { useEffect, useRef, useState } from "react";
import { ActionDialog } from "@/components/shared/action-dialog";
import { buttonClass } from "@/components/shared/panel";
import { COPY, type ShareEnv } from "../lib/share";

/**
 * The last way to save the DP where downloads and the share list fail: the
 * finished PNG as a plain picture, which every phone browser, in-app ones
 * included, lets you press and hold to save. The picture is an object URL in
 * this tab; it is let go when the dialog closes.
 */
export default function HoldToSave({
  open,
  onClose,
  env,
  platformLine,
  blobKey,
  getBlob,
}: {
  open: boolean;
  onClose: () => void;
  env: ShareEnv;
  /** "Then open X and post it…", when a mark opened this. */
  platformLine: string | null;
  /** Which picture; a new one is made when it changes. */
  blobKey: string | null;
  getBlob: () => Promise<Blob>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const getRef = useRef(getBlob);
  getRef.current = getBlob;

  useEffect(() => {
    if (!open || !blobKey) return;
    let live = true;
    let made: string | null = null;
    getRef.current().then(
      (blob) => {
        if (!live) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
      setFailed(false);
    };
  }, [open, blobKey]);

  return (
    <ActionDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={COPY.holdTitle}
      description={COPY.holdHow(env)}
    >
      {url ? (
        // A blob URL made in this tab: next/image cannot take one, and a
        // plain <img> is what press-and-hold saves.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={COPY.holdAlt}
          className="mx-auto block h-auto max-h-[60svh] w-auto max-w-full rounded-lg"
        />
      ) : (
        <p aria-live="polite" className="flex aspect-square max-h-[60svh] w-full items-center justify-center rounded-lg bg-control text-sm text-ink-3">
          {failed ? COPY.notSaved : COPY.holdWaiting}
        </p>
      )}
      {platformLine && <p className="mt-4 text-sm text-ink-2">{platformLine}</p>}
      {env.inApp && <p className="mt-2 text-sm text-ink-3">{COPY.holdFallback(env)}</p>}
      <div className="mt-5 flex justify-end">
        <button type="button" className={buttonClass("secondary", "w-full sm:w-auto")} onClick={onClose}>
          {COPY.done}
        </button>
      </div>
    </ActionDialog>
  );
}
