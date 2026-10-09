"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { ImagePlus, Lock, RotateCcw } from "lucide-react";
import { Field, Segmented, buttonClass, control } from "@/components/shared/panel";
import {
  ART,
  DP_ROLES,
  roleFromQuery,
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
  type DPRole,
  type FooterTiers,
  type PhotoTransform,
} from "../lib/dp";
import { drawDP, nameSubstitutions, renderFull, type DPAssets, type DPResult } from "../lib/draw";
import type { LetterNote } from "../lib/letters";
import { loadAssets, PhotoError, readPhoto, type LoadedPhoto } from "../lib/load";
import {
  COPY,
  DESKTOP_ENV,
  DOWNLOAD_GUARD_MS,
  PLATFORM_NAME,
  RENDER_DEBOUNCE_MS,
  REVOKE_AFTER_MS,
  SHARE_QUALITY,
  detectEnv,
  deviceClass,
  moveHint,
  platformAction,
  shareData,
  statusAction,
  type ButtonId,
  type Platform,
  type ShareEnv,
} from "../lib/share";
import HoldToSave from "./HoldToSave";
import InAppNotice from "./InAppNotice";
import ShareActions, { type Busy } from "./ShareActions";

const ROLE_OPTIONS = DP_ROLES.map((value) => ({ value, label: roleCopy(value).label }));

/** Arrow keys and the hidden Move buttons move the photo this far (a fiftieth of the frame); Shift, further. */
const NUDGE = 0.02;
const NUDGE_FAR = 0.08;

/** The name strip shows this far either side of the middle, in the 2160 square. */
const STRIP_HALF_W = 900;
/** The drag handle covers the photo and its ring: this times the photo's radius. */
const HANDLE_SCALE = 1.3;
/** Space kept above the picture when it is scrolled into view. */
const REVEAL_GAP = 12;
/*
 * After Enter, a phone's keyboard goes down over a quarter second or so,
 * resizing the screen as it goes. The picture is brought into view once the
 * screen has kept still this long after its last resize; if it never
 * resizes (a hardware keyboard), after the first wait; and never later than
 * the last.
 */
const KEYBOARD_SETTLE_MS = 120;
const KEYBOARD_WAIT_MS = 400;
const KEYBOARD_WAIT_MAX_MS = 1000;

type FileType = "image/png" | "image/jpeg";

interface Geometry {
  hub: { x: number; y: number };
  photoR: number;
  zone: { top: number; bottom: number };
}

type Gesture =
  | { kind: "drag"; id: number; x0: number; y0: number; t0: PhotoTransform }
  | { kind: "pinch"; d0: number; t0: PhotoTransform };

interface RenderEntry {
  key: string;
  promise: Promise<Blob>;
  blob: Blob | null;
}

const STALE = "stale";
const isStale = (e: unknown) => e instanceof Error && e.message === STALE;
const pct = (v: number) => `${(v / DP_SIZE) * 100}%`;

/**
 * The Get DP generator: say how you are coming, type your name, add a photo,
 * move it in the frame, then share or save the picture.
 *
 * Built for a phone first: one card of steps in reading order, with a slice
 * of the live picture (role, name, days) between the role and the name, then
 * the picture with its own controls under it. On a wide screen the picture
 * sits beside the steps.
 *
 * The full picture is drawn ahead, 300ms after the last change, so a tap on
 * Share reaches the phone's share list inside the same tap: Safari refuses a
 * share that waited on drawing.
 *
 * The photo never leaves the device: it is read into a canvas in this tab,
 * drawn there, and handed to the person as a file or to their phone's share
 * list. No request carries it.
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
  const [assetsError, setAssetsError] = useState(false);
  const [assetsAttempt, setAssetsAttempt] = useState(0);
  const [drawError, setDrawError] = useState(false);
  const [drawAttempt, setDrawAttempt] = useState(0);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [env, setEnv] = useState<ShareEnv>(DESKTOP_ENV);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [pressed, setPressed] = useState<Platform | null>(null);
  const [captionState, setCaptionState] = useState<"idle" | "copied" | "failed">("idle");
  /** The press-and-hold picture, open, with the mark (or WhatsApp Status) that opened it. */
  const [hold, setHold] = useState<{ platform?: Platform | "status"; copied: boolean } | null>(null);
  /**
   * The letter check, and which name it was made for. Notes of null: the
   * check could not run (the lettering did not load), so the name is not
   * cleared, and Try again runs it again.
   */
  const [letterCheck, setLetterCheck] = useState<{ name: string; notes: LetterNote[] | null } | null>(null);

  const previewRef = useRef<HTMLCanvasElement>(null);
  const stripRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<DPResult | null>(null);
  const photoCount = useRef(0);
  /** The latest photo pick; an older pick that finishes later is ignored. */
  const photoPick = useRef(0);
  const changeRef = useRef<HTMLButtonElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const frameBoxRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const hadPhoto = useRef(false);
  const revealedFor = useRef(0);
  /** Stops a reveal still waiting for the keyboard to go down. */
  const keyboardWait = useRef<(() => void) | null>(null);

  /* Gestures on the picture. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const transformRef = useRef<PhotoTransform | null>(null);

  /* The full picture, drawn ahead and kept per picture and file type. */
  const renders = useRef(new Map<string, RenderEntry>());
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const latestKey = useRef<string | null>(null);

  /* Saving. */
  const sheetOpen = useRef(false);
  const lastDownload = useRef<{ key: string; at: number } | null>(null);
  const lastUrl = useRef<{ url: string; timer: number } | null>(null);
  const downloadedKey = useRef<string | null>(null);
  const copiedTimer = useRef<number | undefined>(undefined);

  const tidy = tidyName(name);
  const shown = drawableName(name);
  /*
   * Letters the lettering cannot set as typed. A plain ASCII name never
   * needs the check; any other name waits for it (null) before it can be
   * saved, so a letter the face cannot draw never reaches a picture.
   */
  const needsLetterCheck = /[^\u0000-\u007F]/.test(shown);
  const notes: LetterNote[] | null = !needsLetterCheck
    ? []
    : letterCheck?.name === shown
      ? letterCheck.notes
      : null;
  /* The check for this name failed: saving stays shut, and Try again is offered. */
  const checkFailed = needsLetterCheck && letterCheck?.name === shown && letterCheck.notes === null;
  const undrawable = (notes ?? []).filter((n) => n.drawn === null).map((n) => n.letter);
  const substitutions = (notes ?? []).filter(
    (n): n is { letter: string; drawn: string } => n.drawn !== null,
  );
  const problem =
    nameProblem(name) ??
    (undrawable.length
      ? `The picture's lettering cannot draw ${undrawable.slice(0, 3).join(" ")}. Write it the nearest plain way to get your DP.`
      : null);
  const showProblem = problem !== null && (nameTouched || nameLength(name) >= 2);
  const ready =
    problem === null && notes !== null && !!photo && !!transform && !!assets && !readingPhoto;
  const roleText = roleCopy(role);
  const cls = deviceClass(env);
  const caption = shareText(role);
  const fileName = dpFileName(tidy);

  /* The role a link asked for (/getdp?role=speaker from /speakers), after
     the first paint so the server's page and the first render agree. */
  useEffect(() => {
    const asked = roleFromQuery(window.location.search);
    if (asked) setRole(asked);
  }, []);

  /* What this device can do with the picture, once, after the first paint. */
  useEffect(() => {
    const canShare = (type: FileType) => {
      try {
        const probe = new File([new Blob()], type === "image/jpeg" ? "dp.jpg" : "dp.png", { type });
        return (
          typeof navigator.share === "function" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [probe] })
        );
      } catch {
        return false;
      }
    };
    setEnv(
      detectEnv({
        ua: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints ?? 0,
        coarse: !!window.matchMedia?.("(pointer: coarse)")?.matches,
        canShareJpeg: canShare("image/jpeg"),
        canSharePng: canShare("image/png"),
      }),
    );
  }, []);

  /* The mark and the partner logos; again on Try again. */
  useEffect(() => {
    let live = true;
    loadAssets(tiers)
      .then((a) => {
        if (!live) return;
        setAssets(a);
        setAssetsError(false);
      })
      .catch(() => live && setAssetsError(true));
    return () => {
      live = false;
    };
  }, [tiers, assetsAttempt]);

  /*
   * Letters the lettering has no form of, said under the name. A check that
   * fails (the faces timed out) clears nothing: it is said as the lettering
   * not loading, and runs again on Try again.
   */
  useEffect(() => {
    if (!assets || !needsLetterCheck) return;
    let live = true;
    nameSubstitutions(shown)
      .then((s) => live && setLetterCheck({ name: shown, notes: s }))
      .catch(() => live && setLetterCheck({ name: shown, notes: null }));
    return () => {
      live = false;
    };
  }, [shown, needsLetterCheck, assets, drawAttempt]);

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

  /*
   * The live preview, drawn at half size, once per frame at most. Each draw
   * also repaints the name strip (a phone's view of the role, name and days
   * while typing) and records where the photo and the text band landed.
   */
  useEffect(() => {
    if (!assets) return;
    const canvas = previewRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    let live = true;
    const paintStrip = (zone: DPResult["zone"] | undefined) => {
      const strip = stripRef.current;
      const preview = previewRef.current;
      if (!strip || !preview || !zone || !strip.clientWidth) return;
      const g = strip.getContext("2d");
      if (!g || typeof g.drawImage !== "function") return;
      const zoneH = zone.bottom - zone.top;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(strip.clientWidth * dpr);
      const h = Math.round((w * zoneH) / (STRIP_HALF_W * 2));
      if (strip.width !== w || strip.height !== h) {
        strip.width = w;
        strip.height = h;
      }
      const k = preview.width / DP_SIZE;
      g.drawImage(preview, (DP_SIZE / 2 - STRIP_HALF_W) * k, zone.top * k, STRIP_HALF_W * 2 * k, zoneH * k, 0, 0, w, h);
    };
    const id = requestAnimationFrame(() => {
      drawDP(ctx, options(), assets)
        .then((result) => {
          if (!live) return;
          frameRef.current = result;
          setDrawError(false);
          if (result.zone) {
            setGeometry((prev) =>
              prev &&
              prev.hub.x === result.hub.x &&
              prev.hub.y === result.hub.y &&
              prev.photoR === result.photoR &&
              prev.zone.top === result.zone.top &&
              prev.zone.bottom === result.zone.bottom
                ? prev
                : { hub: result.hub, photoR: result.photoR, zone: result.zone },
            );
          }
          paintStrip(result.zone);
        })
        .catch(() => {
          if (live) setDrawError(true);
        });
    });
    return () => {
      live = false;
      cancelAnimationFrame(id);
    };
  }, [assets, options, drawAttempt]);

  const key = photo && transform
    ? `${role}|${drawableName(name)}|${photo.id}|${transform.zoom}|${transform.offsetX}|${transform.offsetY}`
    : null;

  /*
   * A new picture: an old notice ("Downloading…") stops being true, and the
   * files drawn for other pictures are let go.
   */
  useEffect(() => {
    latestKey.current = key;
    setNotice(null);
    for (const [id, entry] of renders.current) {
      if (entry.key !== key) renders.current.delete(id);
    }
  }, [key]);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  /* A new caption (a new role) has not been copied. */
  useEffect(() => {
    setCaptionState("idle");
  }, [caption]);

  /**
   * The full picture for `k` as `type`, drawn once. Renders run one at a time
   * (a phone has room for one 2160 canvas). A queued one whose picture has
   * changed since is skipped, and one whose picture changed while it was
   * drawing is dropped: either way it rejects as stale, so a share, a
   * download or the press-and-hold picture never gets the picture the
   * person has just changed.
   */
  const ensure = useCallback(
    (k: string, type: FileType): Promise<Blob> => {
      const id = `${k}|${type}`;
      const hit = renders.current.get(id);
      if (hit) return hit.promise;
      if (!assets) return Promise.reject(new Error("Not ready"));
      const opts = options();
      const promise = chain.current.then(async () => {
        if (latestKey.current !== k) throw new Error(STALE);
        const blob = await renderFull(opts, assets, type, type === "image/jpeg" ? SHARE_QUALITY : undefined);
        if (latestKey.current !== k) throw new Error(STALE);
        return blob;
      });
      chain.current = promise.catch(() => undefined);
      const entry: RenderEntry = { key: k, promise, blob: null };
      renders.current.set(id, entry);
      promise.then(
        (blob) => {
          entry.blob = blob;
        },
        () => {
          if (renders.current.get(id) === entry) renders.current.delete(id);
        },
      );
      return promise;
    },
    [assets, options],
  );

  /* Drawn ahead once the picture settles, in the type this device shares. */
  useEffect(() => {
    if (!ready || !key) return;
    const id = window.setTimeout(() => {
      ensure(key, env.shareType).catch(() => undefined);
    }, RENDER_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [ready, key, env.shareType, ensure]);

  /* A download's file is let go when the page is. */
  useEffect(
    () => () => {
      if (lastUrl.current) {
        window.clearTimeout(lastUrl.current.timer);
        URL.revokeObjectURL(lastUrl.current.url);
      }
      window.clearTimeout(copiedTimer.current);
      keyboardWait.current?.();
    },
    [],
  );

  /* ---------------------------------------------------------------- */
  /* Bringing the picture into view on a phone                        */
  /* ---------------------------------------------------------------- */

  /**
   * Scrolls so the picture's top sits just under the top of the screen; on a
   * short phone the top of the picture gives way so the first save button is
   * on screen too, but only the mark and the theme line: never past the
   * ring's outer edge, so the ring and the photo stay whole. Not on a wide
   * screen, where the picture is beside the steps.
   */
  const revealPicture = useCallback(() => {
    if (window.matchMedia?.("(min-width: 1024px)")?.matches) return;
    const section = sectionRef.current;
    if (!section) return;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const s = section.getBoundingClientRect();
    const top = window.scrollY + s.top - REVEAL_GAP;
    const primary = primaryRef.current?.getBoundingClientRect();
    const fit = primary ? window.scrollY + primary.bottom + REVEAL_GAP - vh : top;
    // The ring's outer top, in the picture as shown (held sideways, the
    // picture is narrower than its card). Before the first draw, none.
    const picture = frameBoxRef.current?.getBoundingClientRect().width || s.width;
    const art = frameRef.current;
    const ringTop = art ? art.hub.y - art.photoR - ART.moat - ART.line / 2 : 0;
    const cap = Math.max(0, (ringTop / DP_SIZE) * picture);
    const target = Math.min(Math.max(top, fit), top + cap);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    window.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
  }, []);

  /**
   * The same, once the keyboard is down: measured while it is still going
   * down, the screen is a few hundred pixels short and too much of the
   * picture would scroll off.
   */
  const revealAfterKeyboard = useCallback(() => {
    keyboardWait.current?.();
    const vv = window.visualViewport;
    if (!vv) {
      revealPicture();
      return;
    }
    let quiet = 0;
    let latest = 0;
    const stop = () => {
      window.clearTimeout(quiet);
      window.clearTimeout(latest);
      vv.removeEventListener("resize", onResize);
      keyboardWait.current = null;
    };
    const done = () => {
      stop();
      revealPicture();
    };
    const onResize = () => {
      window.clearTimeout(quiet);
      quiet = window.setTimeout(done, KEYBOARD_SETTLE_MS);
    };
    quiet = window.setTimeout(done, KEYBOARD_WAIT_MS);
    latest = window.setTimeout(done, KEYBOARD_WAIT_MAX_MS);
    vv.addEventListener("resize", onResize);
    keyboardWait.current = stop;
  }, [revealPicture]);

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
    }
    hadPhoto.current = has;
    if (photo && photo.id !== revealedFor.current) {
      revealedFor.current = photo.id;
      const id = requestAnimationFrame(revealPicture);
      return () => cancelAnimationFrame(id);
    }
  }, [photo, revealPicture]);

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

  /* The Enter or "done" key puts the keyboard away and shows the picture once it has gone. */
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const active = document.activeElement;
    const typing = active instanceof HTMLInputElement;
    if (typing) active.blur();
    if (!ready) return;
    if (typing) revealAfterKeyboard();
    else revealPicture();
  };

  /* ---------------------------------------------------------------- */
  /* Moving the photo                                                 */
  /* ---------------------------------------------------------------- */

  const applyTransform = (t: PhotoTransform) => {
    transformRef.current = t;
    setTransform(t);
  };

  const setZoom = (zoom: number) => {
    if (!photo || !transform) return;
    // Zoom about the frame's centre: the point there stays there.
    const k = zoom / transform.zoom;
    applyTransform(
      clampTransform(
        { zoom, offsetX: transform.offsetX * k, offsetY: transform.offsetY * k },
        photo.width,
        photo.height,
      ),
    );
  };

  const nudge = (dx: number, dy: number) => {
    if (!photo || !transform) return;
    applyTransform(nudgeTransform(transform, dx, dy, photo.width, photo.height));
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

  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  const capture = (e: PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* a pointer the browser no longer tracks */
    }
  };

  /*
   * One finger (or the mouse) on the photo's circle drags it; a swipe that
   * starts anywhere else on the picture scrolls the page. A second finger
   * anywhere on the picture while dragging pinches; lifting one carries on
   * as a drag from the other with no jump. A third is ignored.
   */
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const t = transformRef.current;
    if (!photo || !t) return;
    const map = pointers.current;
    if (map.size === 0) {
      if (!(e.target instanceof Node) || !circleRef.current?.contains(e.target)) return;
      map.set(e.pointerId, { x: e.clientX, y: e.clientY });
      capture(e);
      gesture.current = { kind: "drag", id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: t };
      return;
    }
    if (map.size === 1 && gesture.current?.kind === "drag" && !map.has(e.pointerId)) {
      map.set(e.pointerId, { x: e.clientX, y: e.clientY });
      capture(e);
      gesture.current = { kind: "pinch", d0: Math.max(1, spread()), t0: t };
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointers.current.get(e.pointerId);
    const g = gesture.current;
    if (!p || !g || !photo) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (g.kind === "drag") {
      if (g.id !== e.pointerId) return;
      const [fx, fy] = toFrame(e.clientX - g.x0, e.clientY - g.y0);
      applyTransform(nudgeTransform(g.t0, fx, fy, photo.width, photo.height));
    } else {
      const zoom = Math.min(ZOOM_MAX, Math.max(1, (g.t0.zoom * spread()) / g.d0));
      const k = zoom / g.t0.zoom;
      applyTransform(
        clampTransform(
          { zoom, offsetX: g.t0.offsetX * k, offsetY: g.t0.offsetY * k },
          photo.width,
          photo.height,
        ),
      );
    }
  };

  /* Up, cancelled (a call, an edge swipe) or lost: the photo stays where it is. */
  const endPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const rest = [...pointers.current.entries()];
    const t = transformRef.current;
    if (gesture.current?.kind === "pinch" && rest.length === 1 && t) {
      const [id, p] = rest[0];
      gesture.current = { kind: "drag", id, x0: p.x, y0: p.y, t0: t };
    } else if (rest.length === 0) {
      gesture.current = null;
    }
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
      nudge(move[0], move[1]);
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      setZoom(Math.min(ZOOM_MAX, transform.zoom + 0.1));
    } else if (e.key === "-") {
      e.preventDefault();
      setZoom(Math.max(1, transform.zoom - 0.1));
    }
  };

  const resetPosition = () => {
    if (photo) applyTransform(defaultTransform(photo.width, photo.height));
  };

  const retry = () => {
    if (assetsError) {
      setAssetsError(false);
      setAssetsAttempt((n) => n + 1);
    } else {
      // Draws again, and runs a letter check that failed again (pending till it answers).
      setDrawError(false);
      setLetterCheck((c) => (c?.notes === null ? null : c));
      setDrawAttempt((n) => n + 1);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Sharing and saving                                               */
  /* ---------------------------------------------------------------- */

  /**
   * The caption onto the clipboard, never awaited before a share: writing
   * checks for the tap but does not use it up. Only a failure is said.
   */
  const copyCaptionQuietly = (): Promise<boolean> => {
    let p: Promise<void> | undefined;
    try {
      p = navigator.clipboard?.writeText(caption);
    } catch {
      p = undefined;
    }
    if (!p) {
      setNotice(COPY.copyFailedAuto);
      return Promise.resolve(false);
    }
    return p.then(
      () => true,
      () => {
        setNotice(COPY.copyFailedAuto);
        return false;
      },
    );
  };

  /** What a failed share said; no longer true once the list opens. */
  const clearShareFailure = () =>
    setNotice((n) => (n === COPY.tapAgain || n === COPY.shareFailed || n === COPY.shareFailedHold ? null : n));

  const onShareError = (e: unknown) => {
    const why = (e as { name?: string } | null)?.name;
    if (why === "AbortError" || why === "InvalidStateError") return;
    if (why === "NotAllowedError") {
      setNotice(COPY.tapAgain);
    } else if (env.inApp) {
      setNotice(COPY.shareFailedHold);
      setHold({ copied: true });
    } else {
      setNotice(COPY.shareFailed);
    }
  };

  /** Opens the share list with the file. Called inside the tap whenever the file is ready. */
  const openSheet = (blob: Blob, type: FileType, by: Busy["by"]) => {
    const file = new File([blob], dpFileName(tidy, type === "image/jpeg" ? "jpg" : "png"), { type });
    const data = shareData(
      file,
      env,
      caption,
      typeof navigator.canShare === "function" ? (d) => navigator.canShare(d) : undefined,
    );
    sheetOpen.current = true;
    setBusy({ kind: "sheet", by });
    clearShareFailure();
    let pending: Promise<void>;
    try {
      pending =
        typeof navigator.share === "function"
          ? navigator.share(data)
          : Promise.reject(new TypeError("No share list"));
    } catch (e) {
      pending = Promise.reject(e);
    }
    pending.then(() => undefined, onShareError).finally(() => {
      sheetOpen.current = false;
      setBusy(null);
    });
  };

  /**
   * The share tap. Synchronous when the file has been drawn ahead, which is
   * nearly always; otherwise it says "Preparing…" and shares when the file
   * is ready, which Safari may refuse (then: "Tap again").
   */
  const shareNow = (by: Busy["by"], { copy = true, before }: { copy?: boolean; before?: string } = {}) => {
    if (!ready || !key || sheetOpen.current) return;
    if (copy) void copyCaptionQuietly();
    if (before) setNotice(before);
    const type = env.shareType;
    const cached = renders.current.get(`${key}|${type}`)?.blob;
    if (cached) {
      openSheet(cached, type, by);
      return;
    }
    setBusy({ kind: "prepare", by });
    ensure(key, type).then(
      (blob) => openSheet(blob, type, by),
      (e) => {
        setBusy(null);
        // Stale: the picture changed while it was drawn, so nothing is
        // shared; the new one is drawn ahead and the next tap shares it.
        setNotice(isStale(e) ? COPY.tapAgain : COPY.notSaved);
      },
    );
  };

  const saveFile = (blob: Blob, k: string) => {
    if (lastUrl.current) {
      window.clearTimeout(lastUrl.current.timer);
      URL.revokeObjectURL(lastUrl.current.url);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      if (lastUrl.current?.url === url) lastUrl.current = null;
    }, REVOKE_AFTER_MS);
    lastUrl.current = { url, timer };
    downloadedKey.current = k;
    // The browser takes it from here: say what was asked for, and where it
    // goes, not that it is saved.
    setNotice(COPY.downloading(env, fileName));
  };

  /** The PNG, in the same tap when it is drawn already. */
  const startDownload = (by: Busy["by"]) => {
    if (!key) return;
    const k = key;
    const cached = renders.current.get(`${k}|image/png`)?.blob;
    if (cached) {
      saveFile(cached, k);
      return;
    }
    setBusy({ kind: "download", by });
    // A picture changed while it was drawn rejects as stale and saves nothing.
    ensure(k, "image/png")
      .then(
        (blob) => saveFile(blob, k),
        (e) => {
          if (!isStale(e)) setNotice(COPY.notSaved);
        },
      )
      .finally(() => setBusy(null));
  };

  const download = () => {
    if (!ready || !key) return;
    const now = Date.now();
    if (lastDownload.current?.key === key && now - lastDownload.current.at < DOWNLOAD_GUARD_MS) return;
    lastDownload.current = { key, at: now };
    startDownload("download");
  };

  const onButton = (id: ButtonId) => {
    if (!ready || busy) return;
    switch (id) {
      case "share":
      case "more":
        shareNow(id);
        return;
      case "photos":
        if (cls === "sheet") shareNow(id, { copy: false, before: COPY.choosePhotos });
        else setHold({ copied: true });
        return;
      case "download":
        download();
        return;
      case "save":
        setHold({ copied: true });
        return;
    }
  };

  const onMark = (p: Platform, e: MouseEvent<HTMLElement>) => {
    if (!ready || !key || busy) {
      e.preventDefault();
      return;
    }
    const action = platformAction(p, env, caption, fileName);
    setPressed(p);
    setTip(action.tip);
    switch (action.kind) {
      case "sheet":
        shareNow(p);
        return;
      case "link":
      case "save":
        // A link opens by itself: a real link, so no popup blocker applies.
        void copyCaptionQuietly();
        if (downloadedKey.current !== key) startDownload(p);
        return;
      case "hold":
        setHold({ platform: p, copied: true });
        // A refused copy: neither the dialog nor the tip may say it is copied.
        void copyCaptionQuietly().then((ok) => {
          if (ok) return;
          setHold((h) => (h?.platform === p ? { ...h, copied: false } : h));
          setTip((t) => (t === action.tip ? COPY.holdPlatform(PLATFORM_NAME[p], false) : t));
        });
        return;
    }
  };

  /** WhatsApp Status, on a phone: the share list where it takes the file, else save and say where. */
  const onStatus = () => {
    if (!ready || !key || busy) return;
    const action = statusAction(env);
    if (!action) return;
    // The marks' tip is about another app.
    setPressed(null);
    setTip(null);
    switch (action.kind) {
      case "sheet":
        shareNow("status");
        return;
      case "save":
        void copyCaptionQuietly();
        if (downloadedKey.current !== key) startDownload("status");
        return;
      case "hold":
        setHold({ platform: "status", copied: true });
        void copyCaptionQuietly().then((ok) => {
          if (!ok) setHold((h) => (h?.platform === "status" ? { ...h, copied: false } : h));
        });
        return;
    }
  };

  const copyCaption = () => {
    let p: Promise<void> | undefined;
    try {
      p = navigator.clipboard?.writeText(caption);
    } catch {
      p = undefined;
    }
    (p ?? Promise.reject(new Error("No clipboard"))).then(
      () => {
        setCaptionState("copied");
        window.clearTimeout(copiedTimer.current);
        copiedTimer.current = window.setTimeout(() => setCaptionState("idle"), 2000);
      },
      () => setCaptionState("failed"),
    );
  };

  const holdBlob = useCallback(
    () => (key ? ensure(key, "image/png") : Promise.reject(new Error("Not ready"))),
    [ensure, key],
  );

  /** Why saving is shut, in words; null once it is open. */
  const needs = ((): string | null => {
    if (assetsError || drawError || checkFailed) return COPY.needsRetry;
    const noPhoto = !photo && !readingPhoto;
    if (tidy === "") return noPhoto ? COPY.needsNameAndPhoto : COPY.needsName;
    if (problem !== null) return noPhoto ? COPY.fixNameAndPhoto : COPY.fixName;
    if (noPhoto) return COPY.needsPhoto;
    if (readingPhoto) return COPY.openingPhoto;
    if (!assets || notes === null) return COPY.preparingDP;
    return null;
  })();

  /* ---------------------------------------------------------------- */

  const letters = nameLength(name);
  const left = NAME_MAX - letters;
  const counter = letters > NAME_MAX - 10 && letters <= NAME_MAX
    ? `${left} ${left === 1 ? "letter" : "letters"} left.`
    : undefined;
  const zoneH = geometry ? geometry.zone.bottom - geometry.zone.top : ART.textBlock;
  const handleR = geometry ? geometry.photoR * HANDLE_SCALE : 0;

  return (
    <div className="mt-8">
      <InAppNotice env={env} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8">
        {/* The steps, in the order a phone meets them. */}
        <form
          className="divide-y divide-line rounded-xl border border-line-2 bg-card"
          onSubmit={onSubmit}
          noValidate
        >
          <div className="p-5 sm:p-6">
            <Segmented legend="How you're coming" value={role} options={ROLE_OPTIONS} onChange={setRole} />
          </div>

          {/*
            The picture's own role pill, name and days, above the field and the
            keyboard. Never taller than a fifth of the screen, which only a
            phone held sideways reaches: there it stays narrow enough to show
            above the name field with the keyboard up.
          */}
          <div className="lg:hidden" aria-hidden="true">
            <canvas
              ref={stripRef}
              className="mx-auto block h-auto w-full max-w-[calc(20svh*var(--strip-aspect))] bg-control"
              style={{ aspectRatio: `${STRIP_HALF_W * 2} / ${zoneH}`, "--strip-aspect": (STRIP_HALF_W * 2) / zoneH } as CSSProperties}
            />
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
              onChange={(e) => {
                // Read the file, then clear the input, so choosing the same
                // photo again after Change still counts as a choice.
                const file = e.target.files?.[0];
                e.target.value = "";
                void takeFile(file);
              }}
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
        <section
          ref={sectionRef}
          aria-labelledby="dp-preview-title"
          className="overflow-hidden rounded-xl border border-line-2 bg-card lg:sticky lg:top-24"
        >
          <h2 id="dp-preview-title" className="sr-only">
            Your DP
          </h2>
          <div
            tabIndex={photo ? 0 : -1}
            role="group"
            aria-label={photo ? COPY.frameLabel : "Your DP"}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onLostPointerCapture={endPointer}
            onKeyDown={onPreviewKey}
            ref={frameBoxRef}
            // The ring sits inside the edge: the card's overflow-hidden (which
            // rounds the canvas corners) would clip the site's outside ring.
            // Below lg, capped at the screen's height (less a margin), so a
            // phone held sideways sees the whole picture; from lg it fills
            // its card, as it always has.
            className="relative mx-auto w-full max-lg:max-w-[calc(100svh-5rem)] select-none focus-visible:-outline-offset-2 focus-visible:outline-brand-blue-light"
          >
            <canvas
              ref={previewRef}
              width={PREVIEW_SIZE}
              height={PREVIEW_SIZE}
              role="img"
              aria-label={`Preview: ${roleText.line.replace("’", "'")}, ${drawableName(name) || "your name"}`}
              className="block aspect-square h-auto w-full bg-control"
            />
            {photo && geometry && (
              // The photo moves from its circle and ring only: anywhere else,
              // a swipe scrolls the page.
              <div
                ref={circleRef}
                aria-hidden="true"
                className="absolute cursor-grab touch-none rounded-full [-webkit-touch-callout:none] active:cursor-grabbing"
                style={{
                  left: pct(geometry.hub.x - handleR),
                  top: pct(geometry.hub.y - handleR),
                  width: pct(handleR * 2),
                  height: pct(handleR * 2),
                }}
              />
            )}
            {!assets && !assetsError && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-3" aria-live="polite">
                Preparing the picture…
              </p>
            )}
          </div>

          {photo && transform && (
            <div className="border-t border-line px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="dp-zoom" className="text-sm font-semibold text-white">
                  Zoom
                </label>
                <button type="button" className={buttonClass("quiet", "-mr-3")} onClick={resetPosition}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Reset
                </button>
              </div>
              <input
                id="dp-zoom"
                type="range"
                min={1}
                max={ZOOM_MAX}
                step={0.01}
                value={transform.zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="block h-11 w-full cursor-pointer accent-brand-gold"
              />
              <p className="mt-1 text-sm text-ink-3">
                {moveHint(cropLimits(photo.width, photo.height, transform.zoom), env.phone)}
              </p>
              {/* For a screen reader on a phone, where there are no arrow keys; shown when focused. */}
              <div
                role="group"
                aria-label={COPY.moveGroup}
                className="sr-only focus-within:not-sr-only focus-within:mt-3 focus-within:flex focus-within:flex-wrap focus-within:gap-2"
              >
                {(
                  [
                    ["Move up", 0, -1],
                    ["Move down", 0, 1],
                    ["Move left", -1, 0],
                    ["Move right", 1, 0],
                  ] as const
                ).map(([label, dx, dy]) => (
                  <button
                    key={label}
                    type="button"
                    className={buttonClass("secondary")}
                    onClick={() => nudge(dx * NUDGE, dy * NUDGE)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(assetsError || drawError || checkFailed) && (
            <div className="border-t border-line px-5 py-4 sm:px-6">
              <p role="alert" className="text-sm text-red-300">
                {assetsError ? COPY.assetsError : COPY.fontsError}
              </p>
              <button type="button" className={buttonClass("secondary", "mt-3")} onClick={retry}>
                {COPY.tryAgain}
              </button>
            </div>
          )}

          <ShareActions
            env={env}
            ready={ready}
            busy={busy}
            status={notice ?? needs ?? COPY.ready(cls)}
            statusFile={!notice && !needs && COPY.readyNamesFile(cls) ? fileName : undefined}
            profile={ready ? COPY.profile(env) : null}
            tip={tip}
            pressed={pressed}
            caption={caption}
            fileName={fileName}
            captionState={captionState}
            primaryRef={primaryRef}
            onButton={onButton}
            onMark={onMark}
            onStatus={onStatus}
            onCopyCaption={copyCaption}
          />

          <p className="flex items-start gap-2 border-t border-line px-5 py-4 text-sm text-ink-3 sm:px-6">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Your photo is processed on this device and never uploaded.
          </p>
        </section>
      </div>

      <HoldToSave
        open={hold !== null}
        onClose={() => setHold(null)}
        env={env}
        platformLine={
          hold?.platform === "status"
            ? COPY.holdStatus(hold.copied)
            : hold?.platform
              ? COPY.holdPlatform(PLATFORM_NAME[hold.platform], hold.copied)
              : null
        }
        blobKey={key}
        getBlob={holdBlob}
      />
    </div>
  );
}
