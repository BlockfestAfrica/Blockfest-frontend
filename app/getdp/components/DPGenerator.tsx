"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Download, ImagePlus, Lock, RotateCcw, Share2 } from "lucide-react";
import { Field, Segmented, buttonClass, control } from "@/components/shared/panel";
import {
  DP_ROLES,
  DP_SIZE,
  NAME_MAX,
  PREVIEW_SIZE,
  ZOOM_MAX,
  clampTransform,
  cropLimits,
  defaultTransform,
  dpFileName,
  drawableName,
  nameLength,
  nameProblem,
  nudgeTransform,
  roleCopy,
  shareText,
  tidyName,
  xIntentUrl,
  type DPRole,
  type FooterTiers,
  type PhotoTransform,
} from "../lib/dp";
import { drawDP, nameSubstitutions, type DPAssets, type DPResult } from "../lib/draw";
import type { LetterNote } from "../lib/letters";
import { loadAssets, PhotoError, readPhoto, type LoadedPhoto } from "../lib/load";

const ROLE_OPTIONS = DP_ROLES.map((value) => ({ value, label: roleCopy(value).label }));

/** Arrow keys move the photo this far (a fiftieth of the frame); Shift, further. */
const NUDGE = 0.02;
const NUDGE_FAR = 0.08;

/**
 * In-app browsers (Instagram, Facebook, TikTok, an Android WebView) often
 * ignore a download, so the page says what to do if nothing is saved.
 */
const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Snapchat|TikTok|musical_ly|Line\/|; wv\)/i;

/** What the page says about moving the photo, given how far it can move. */
function moveHint(limits: { maxX: number; maxY: number }): string {
  const x = limits.maxX > 1e-6;
  const y = limits.maxY > 1e-6;
  if (!x && !y) return "Your photo fills its frame. Zoom in to move it.";
  if (!x) return "Drag the picture up or down to move your photo. Zoom in to move it sideways too.";
  if (!y) return "Drag the picture sideways to move your photo. Zoom in to move it up and down too.";
  return "Drag the picture to move your photo in its frame.";
}

/**
 * The Get DP generator: say how you are coming, type your name, add a photo,
 * move it in the frame, then download or share the picture.
 *
 * Built for a phone first: one card of steps in reading order, then the
 * picture with its own controls under it. On a wide screen the picture sits
 * beside the steps and stays in view.
 *
 * The photo never leaves the device: it is read into a canvas in this tab,
 * drawn there, and handed to the person as a file. No request carries it.
 */
export default function DPGenerator({ tiers }: { tiers: FooterTiers }) {
  const [role, setRole] = useState<DPRole>("attendee");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [photo, setPhoto] = useState<(LoadedPhoto & { id: number }) | null>(null);
  const [transform, setTransform] = useState<PhotoTransform | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [assets, setAssets] = useState<DPAssets | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);
  /** The letter check, and which name it was made for. */
  const [letterCheck, setLetterCheck] = useState<{ name: string; notes: LetterNote[] } | null>(null);

  const previewRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<DPResult | null>(null);
  const dragRef = useRef<{ x: number; y: number; t: PhotoTransform; pointer: number } | null>(null);
  const fullRef = useRef<{ key: string; blob: Blob } | null>(null);
  const photoCount = useRef(0);
  /** The latest photo pick; an older pick that finishes later is ignored. */
  const photoPick = useRef(0);
  const changeRef = useRef<HTMLButtonElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const frameBoxRef = useRef<HTMLDivElement>(null);
  const hadPhoto = useRef(false);

  const tidy = tidyName(name);
  const shown = drawableName(name);
  /*
   * Letters the lettering cannot set as typed. A plain ASCII name never
   * needs the check; any other name waits for it (null) before it can be
   * downloaded, so a letter the face cannot draw never reaches a PNG.
   */
  const needsLetterCheck = /[^\u0000-\u007F]/.test(shown);
  const notes: LetterNote[] | null = !needsLetterCheck
    ? []
    : letterCheck?.name === shown
      ? letterCheck.notes
      : null;
  const undrawable = (notes ?? []).filter((n) => n.drawn === null).map((n) => n.letter);
  const substitutions = (notes ?? []).filter(
    (n): n is { letter: string; drawn: string } => n.drawn !== null,
  );
  const problem =
    nameProblem(name) ??
    (undrawable.length
      ? `The picture's lettering cannot draw ${undrawable.slice(0, 3).join(" ")}. Write it the nearest plain way to download your DP.`
      : null);
  const showProblem = problem !== null && (nameTouched || nameLength(name) >= 2);
  const ready =
    problem === null && notes !== null && !!photo && !!transform && !!assets && !readingPhoto;
  const roleText = roleCopy(role);

  /* The mark and the partner logos, once. */
  useEffect(() => {
    let live = true;
    loadAssets(tiers)
      .then((a) => live && setAssets(a))
      .catch(() => live && setDrawError("The picture could not be prepared. Check your connection and reload the page."));
    return () => {
      live = false;
    };
  }, [tiers]);

  /* Whether this device can hand a file to another app (most phones can). */
  useEffect(() => {
    try {
      const probe = new File([new Blob()], "dp.png", { type: "image/png" });
      setCanShareFiles(
        typeof navigator.share === "function" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [probe] }),
      );
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  /* Letters the lettering has no form of, said under the name. */
  useEffect(() => {
    if (!assets || !needsLetterCheck) return;
    let live = true;
    nameSubstitutions(shown)
      .then((s) => live && setLetterCheck({ name: shown, notes: s }))
      .catch(() => live && setLetterCheck({ name: shown, notes: [] }));
    return () => {
      live = false;
    };
  }, [shown, needsLetterCheck, assets]);

  const options = useCallback(
    () => {
      const shown = drawableName(name);
      return {
        photo: photo?.photo ?? null,
        name: shown || "Your name",
        ghostName: !shown,
        role,
        photoTransform: transform ?? undefined,
      };
    },
    [name, photo, role, transform],
  );

  /* The live preview, drawn at half size, once per frame at most. */
  useEffect(() => {
    if (!assets) return;
    const canvas = previewRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    let live = true;
    const id = requestAnimationFrame(() => {
      drawDP(ctx, options(), assets)
        .then((result) => {
          if (!live) return;
          frameRef.current = result;
          setDrawError(null);
        })
        .catch(() => {
          if (live) setDrawError("The picture's lettering did not load. Check your connection and reload the page.");
        });
    });
    return () => {
      live = false;
      cancelAnimationFrame(id);
    };
  }, [assets, options]);

  const key = photo && transform
    ? `${role}|${drawableName(name)}|${photo.id}|${transform.zoom}|${transform.offsetX}|${transform.offsetY}`
    : null;

  /* A "Saved as" from an earlier picture stops being true once it changes. */
  useEffect(() => {
    setNotice(null);
  }, [key]);

  /** The full-size picture as a PNG, drawn fresh unless it already is. */
  const fullBlob = useCallback(async (): Promise<Blob> => {
    if (!assets || !key) throw new Error("Not ready");
    if (fullRef.current?.key === key) return fullRef.current.blob;
    const canvas = document.createElement("canvas");
    canvas.width = DP_SIZE;
    canvas.height = DP_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D canvas");
    await drawDP(ctx, options(), assets);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No PNG"))), "image/png"),
    );
    fullRef.current = { key, blob };
    return blob;
  }, [assets, key, options]);

  /*
   * Drawn ahead once the picture settles, so Share can open the share sheet
   * straight from the tap: Safari refuses a share that waited on drawing.
   */
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => {
      fullBlob().catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(id);
  }, [ready, fullBlob]);

  /* ---------------------------------------------------------------- */
  /* Photo                                                            */
  /* ---------------------------------------------------------------- */

  const takeFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    const pick = ++photoPick.current;
    setPhotoError(null);
    setReadingPhoto(true);
    try {
      const loaded = await readPhoto(file);
      if (pick !== photoPick.current) return; // a later pick, or Remove, won
      photoCount.current += 1;
      setPhoto({ ...loaded, id: photoCount.current });
      setTransform(defaultTransform(loaded.width, loaded.height));
    } catch (e) {
      if (pick !== photoPick.current) return;
      setPhotoError(
        e instanceof PhotoError ? e.message : "That photo could not be opened. Try another one.",
      );
    } finally {
      if (pick === photoPick.current) setReadingPhoto(false);
    }
  }, []);

  /*
   * The photo button swaps for Change and Remove and back. Keep focus with
   * it, so a keyboard or screen reader user is not dropped to the top of the
   * page; only when focus was actually lost, so a photo dropped while typing
   * the name does not take the cursor away. On a phone the picture sits
   * under the steps, so bring it into view once a photo is in it.
   */
  useEffect(() => {
    const has = photo !== null;
    if (has !== hadPhoto.current) {
      if (document.activeElement === document.body || document.activeElement === null) {
        (has ? changeRef : chooseRef).current?.focus();
      }
      if (has) {
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        frameBoxRef.current?.scrollIntoView?.({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      }
    }
    hadPhoto.current = has;
  }, [photo]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void takeFile(e.dataTransfer.files?.[0]);
  };
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  };

  const removePhoto = () => {
    photoPick.current += 1; // a pick still opening is no longer wanted
    setReadingPhoto(false);
    setPhoto(null);
    setTransform(null);
    setPhotoError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  /* ---------------------------------------------------------------- */
  /* Moving the photo                                                 */
  /* ---------------------------------------------------------------- */

  const setZoom = (zoom: number) => {
    if (!photo || !transform) return;
    // Zoom about the frame's centre: the point there stays there.
    const k = zoom / transform.zoom;
    setTransform(
      clampTransform(
        { zoom, offsetX: transform.offsetX * k, offsetY: transform.offsetY * k },
        photo.width,
        photo.height,
      ),
    );
  };

  /** Pointer movement in CSS pixels, as a fraction of the photo frame. */
  const toFrame = (dx: number, dy: number) => {
    const canvas = previewRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return [0, 0];
    const units = DP_SIZE / (canvas.getBoundingClientRect().width || DP_SIZE);
    const across = frame.photoR * 2;
    return [(dx * units) / across, (dy * units) / across];
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!photo || !transform) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, t: transform, pointer: e.pointerId };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointer !== e.pointerId || !photo) return;
    const [fx, fy] = toFrame(e.clientX - drag.x, e.clientY - drag.y);
    setTransform(nudgeTransform(drag.t, fx, fy, photo.width, photo.height));
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointer === e.pointerId) dragRef.current = null;
  };

  const onPreviewKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!photo || !transform) return;
    const step = e.shiftKey ? NUDGE_FAR : NUDGE;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      setTransform(nudgeTransform(transform, move[0], move[1], photo.width, photo.height));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      setZoom(Math.min(ZOOM_MAX, transform.zoom + 0.1));
    } else if (e.key === "-") {
      e.preventDefault();
      setZoom(Math.max(1, transform.zoom - 0.1));
    }
  };

  const resetPosition = () => {
    if (photo) setTransform(defaultTransform(photo.width, photo.height));
  };

  /* ---------------------------------------------------------------- */
  /* Download and share                                               */
  /* ---------------------------------------------------------------- */

  const fileName = dpFileName(tidy);

  const download = async () => {
    if (!ready) return;
    setBusy("download");
    setNotice(null);
    try {
      const blob = await fullBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      // The browser takes it from here: say what was asked for, not that it
      // is saved, since an in-app browser may quietly do nothing.
      setNotice(
        IN_APP_BROWSER.test(navigator.userAgent)
          ? `Downloading ${fileName}. If nothing is saved, open this page in your browser from this app's menu, then download it there.`
          : `Downloading ${fileName}.`,
      );
    } catch {
      setNotice("The picture could not be saved. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    if (!ready) return;
    const text = shareText(role);
    setNotice(null);
    if (!canShareFiles) {
      window.open(xIntentUrl(text), "_blank", "noopener,noreferrer");
      setNotice("Download your DP too, and attach it to the post on X.");
      return;
    }
    setBusy("share");
    try {
      const blob = await fullBlob();
      const file = new File([blob], fileName, { type: "image/png" });
      await navigator.share({ files: [file], text });
    } catch (e) {
      const why = e instanceof DOMException ? e.name : "";
      if (why === "NotAllowedError") setNotice("Tap Share once more to open the share sheet.");
      else if (why !== "AbortError") setNotice("Sharing did not work here. Download your DP and post it instead.");
    } finally {
      setBusy(null);
    }
  };

  /** Why Download and Share are shut, in words; null once they are open. */
  const needs = ((): string | null => {
    if (drawError) return "Reload the page to try again.";
    const noPhoto = !photo && !readingPhoto;
    if (tidy === "") {
      return noPhoto ? "Add your name and a photo to download your DP." : "Add your name to download your DP.";
    }
    if (problem !== null) {
      return noPhoto ? "Fix your name and add a photo to download your DP." : "Fix your name to download your DP.";
    }
    if (noPhoto) return "Add a photo to download your DP.";
    if (readingPhoto) return "Opening your photo…";
    if (!assets || notes === null) return "Preparing your DP…";
    return null;
  })();

  /* ---------------------------------------------------------------- */

  const letters = nameLength(name);
  const left = NAME_MAX - letters;
  const counter = letters > NAME_MAX - 10 && letters <= NAME_MAX
    ? `${left} ${left === 1 ? "letter" : "letters"} left.`
    : undefined;

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8">
      {/* The steps, in the order a phone meets them. */}
      <form
        className="divide-y divide-line rounded-xl border border-line-2 bg-card"
        onSubmit={(e) => e.preventDefault()}
        noValidate
      >
        <div className="p-5 sm:p-6">
          <Segmented legend="How you're coming" value={role} options={ROLE_OPTIONS} onChange={setRole} />
        </div>

        <div className="p-5 sm:p-6">
          <Field
            id="dp-name"
            label="Your name"
            hint={counter ?? "As you want it on the picture."}
            error={showProblem ? problem ?? undefined : undefined}
          >
            <input
              id="dp-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setNameTouched(true)}
              autoComplete="name"
              autoCapitalize="words"
              spellCheck={false}
              enterKeyHint="done"
              maxLength={80}
              aria-invalid={showProblem}
              placeholder="Ada Obi"
              className={control}
            />
          </Field>
          {letters > NAME_MAX && (
            <p className="mt-2 text-sm text-ink-3">
              That is {letters} letters.
            </p>
          )}
          {substitutions.length > 0 && !showProblem && (
            <p className="mt-2 text-sm text-ink-3">
              The picture&apos;s lettering has no{" "}
              {substitutions.map((s) => `${s.letter}, so it draws ${s.drawn}`).join("; ")}.
            </p>
          )}
        </div>

        <div className="p-5 sm:p-6" onDragOver={onDragOver} onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
          <p id="dp-photo-label" className="text-sm font-semibold text-white">
            Your photo
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.heic,.heif"
            aria-labelledby="dp-photo-label"
            className="hidden"
            onChange={(e) => void takeFile(e.target.files?.[0])}
          />
          {photo ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p id="dp-photo-status" className="w-full min-w-0 text-sm text-ink-2 sm:w-auto sm:flex-1">
                {readingPhoto ? "Opening your new photo…" : "Photo added."}
              </p>
              <button
                ref={changeRef}
                type="button"
                aria-label="Change photo"
                aria-describedby="dp-photo-status"
                className={buttonClass("secondary", "min-w-24")}
                onClick={() => fileRef.current?.click()}
              >
                Change
              </button>
              <button type="button" aria-label="Remove photo" className={buttonClass("quiet")} onClick={removePhoto}>
                Remove
              </button>
            </div>
          ) : (
            <button
              ref={chooseRef}
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-describedby="dp-photo-hint"
              className={`mt-2 flex min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors duration-150 ${
                dragOver ? "border-link bg-card-3" : "border-line-3 bg-control hover:bg-card-2"
              }`}
            >
              <ImagePlus className="h-6 w-6 text-ink-3" aria-hidden="true" />
              <span className="text-sm font-semibold text-white">
                {readingPhoto ? "Opening your photo…" : "Choose a photo"}
              </span>
              <span id="dp-photo-hint" className="text-sm text-ink-3">
                <span className="hidden sm:inline">or drop one here. </span>A clear photo of your face works best.
              </span>
            </button>
          )}
          {photoError && (
            <p role="alert" className="mt-2 text-sm text-red-300">
              {photoError}
            </p>
          )}
        </div>
      </form>

      {/* The picture, with what you do to it under it. */}
      <section aria-labelledby="dp-preview-title" className="overflow-hidden rounded-xl border border-line-2 bg-card lg:sticky lg:top-24">
        <h2 id="dp-preview-title" className="sr-only">
          Your DP
        </h2>
        <div
          tabIndex={photo ? 0 : -1}
          role="group"
          aria-label={
            photo
              ? "Your DP. Drag, or use the arrow keys, to move your photo in its frame; plus and minus zoom."
              : "Your DP"
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onPreviewKey}
          ref={frameBoxRef}
          // The ring sits inside the edge: the card's overflow-hidden (which
          // rounds the canvas corners) would clip the site's outside ring.
          className={`relative scroll-mb-4 focus-visible:-outline-offset-2 focus-visible:outline-brand-blue-light ${photo ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
        >
          <canvas
            ref={previewRef}
            width={PREVIEW_SIZE}
            height={PREVIEW_SIZE}
            role="img"
            aria-label={`Preview: ${roleText.line.replace("’", "'")}, ${drawableName(name) || "your name"}`}
            className="block aspect-square h-auto w-full bg-control"
          />
          {!assets && !drawError && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-3" aria-live="polite">
              Preparing the picture…
            </p>
          )}
        </div>

        {photo && transform && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-5 py-4 sm:px-6">
            <label htmlFor="dp-zoom" className="text-sm font-semibold text-white">
              Zoom
            </label>
            <input
              id="dp-zoom"
              type="range"
              min={1}
              max={ZOOM_MAX}
              step={0.01}
              value={transform.zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-11 min-w-0 flex-1 cursor-pointer accent-brand-gold"
            />
            <button type="button" className={buttonClass("quiet")} onClick={resetPosition}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset
            </button>
            <p className="w-full text-sm text-ink-3">
              {moveHint(cropLimits(photo.width, photo.height, transform.zoom))} On a
              keyboard, the arrow keys move it.
            </p>
          </div>
        )}

        <div className="border-t border-line px-5 py-4 sm:px-6">
          {drawError && (
            <p role="alert" className="mb-3 text-sm text-red-300">
              {drawError}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={buttonClass("primary", "w-full sm:w-auto")}
              disabled={!ready || busy !== null}
              onClick={download}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {busy === "download" ? "Saving…" : "Download PNG"}
            </button>
            <button
              type="button"
              className={buttonClass("secondary", "w-full sm:w-auto")}
              disabled={!ready || busy !== null}
              onClick={share}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              {canShareFiles ? "Share" : "Share on X"}
            </button>
          </div>
          {/* Only the state is live, so typing a name does not read the file name out letter by letter. */}
          <p className="mt-3 text-sm text-ink-3 [overflow-wrap:anywhere]">
            <span aria-live="polite">{notice ?? needs ?? "Ready to download"}</span>
            {!notice && !needs && <span>: {fileName}</span>}
          </p>
          <p className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-sm text-ink-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Your photo is processed on this device and never uploaded.
          </p>
        </div>
      </section>
    </div>
  );
}
