import { blockfest2026Lagos } from "@/lib/events";

const EVENT = blockfest2026Lagos;

export const VENUE_VIDEO = {
  src: "/videos/venue-announcement.mp4",
  poster: "/videos/venue-announcement-poster.webp",
  /** Seconds. Used for the VideoObject duration and the visible run time. */
  durationSeconds: 96,
  width: 1280,
  height: 720,
} as const;

/**
 * Venue announcement.
 *
 * Sits directly under the hero, where someone deciding on a ticket can see the
 * room before they see the prices.
 *
 * It costs nothing to load. `preload="none"` means the browser fetches zero
 * bytes of the 10.8MB file until somebody presses play, so only people who
 * choose to watch pay for it. That matters here more than usual: this audience
 * is ~87% mobile and ~90% Nigeria, and at the connection speeds measured on
 * this site the full video is over two minutes of download and a real slice of
 * a data bundle. The poster is a 42KB WebP and carries the whole section
 * visually on its own.
 *
 * No autoplay, and plain `controls` rather than a custom player, so the section
 * works with JavaScript disabled.
 */
export function VenueVideo() {
  const minutes = Math.floor(VENUE_VIDEO.durationSeconds / 60);
  const seconds = VENUE_VIDEO.durationSeconds % 60;

  return (
    <section
      id="venue"
      className="section-y bg-ground border-t border-white/20"
      aria-label="Venue announcement"
    >
      <div className="container-page">
        <div className="overflow-hidden rounded-xl border border-white/20 bg-white/5">
          {/* biome-ignore lint/a11y/useMediaCaption: no caption track supplied yet; the video carries on-screen titles and the surrounding copy states what it shows */}
          <video
            className="block aspect-video h-auto w-full"
            controls
            preload="none"
            playsInline
            poster={VENUE_VIDEO.poster}
            width={VENUE_VIDEO.width}
            height={VENUE_VIDEO.height}
          >
            <source src={VENUE_VIDEO.src} type="video/mp4" />
            <p className="p-6 text-sm text-white/60">
              Your browser cannot play this video.{" "}
              <a
                href={VENUE_VIDEO.src}
                className="text-brand-blue-light underline underline-offset-2"
              >
                Download it instead
              </a>
              .
            </p>
          </video>
        </div>

        <p className="mt-4 text-sm text-white/60">
          {minutes}:{String(seconds).padStart(2, "0")} · {EVENT.location.venue}{" "}
          · plays only when you press play
        </p>
      </div>
    </section>
  );
}
