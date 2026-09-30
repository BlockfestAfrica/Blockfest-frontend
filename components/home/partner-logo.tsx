import Image from "next/image";
import type { PartnerLogo } from "@/lib/partners-2026";

/**
 * How tall a logo is drawn, relative to a 3:1 wordmark.
 *
 * One height for every logo makes a wide wordmark (The Guardian, 8:1) a long
 * thin line and a square mark (Lagos State's seal) a small dot, so the wall
 * reads as uneven even when every tile is the same. Sizing by the square root
 * of the shape gives each logo roughly the same area instead, which is how
 * conference walls keep mixed logos looking like one set. Clamped so an
 * extreme shape stays legible.
 */
export function logoWeight({ width, height }: Pick<PartnerLogo, "width" | "height">): number {
  const aspect = width / height;
  return Math.min(1.6, Math.max(0.5, Math.sqrt(3 / aspect)));
}

const onX = (href: string) => /^https:\/\/(www\.)?(x|twitter)\.com\//.test(href);

/**
 * A logo on a white tile, linking out when there is somewhere to go.
 *
 * The tile's size and `--logo` (the height of a 3:1 wordmark at that size)
 * come from `className`; the logo scales from there by its own shape. The
 * fallback is there because without it a missing `--logo` makes the height
 * invalid, and the image renders at its full 1280px.
 * `caption` sits under the logo, inside the tile: a sponsor's tier.
 *
 * The link is named outright, "Monica, Headline sponsor, on X (opens in a new
 * tab)": computed from its parts, the logo's alt and the caption run
 * together ("MonicaHeadline sponsor") in some screen readers.
 */
export function LogoTile({
  partner,
  className,
  sizes,
  caption,
}: {
  partner: PartnerLogo;
  className: string;
  sizes: string;
  caption?: string;
}) {
  const tile = `flex w-full flex-col items-center justify-center gap-2 bg-white px-4 ${className}`;
  const image = (
    <Image
      src={partner.logo}
      alt={partner.name}
      width={partner.width}
      height={partner.height}
      sizes={sizes}
      style={{ height: `calc(var(--logo, 24px) * ${logoWeight(partner).toFixed(3)})` }}
      className="w-auto max-w-full object-contain"
    />
  );

  const label = caption ? (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
      {caption}
    </span>
  ) : null;

  if (!partner.href) {
    return (
      <div className={tile}>
        {image}
        {label}
      </div>
    );
  }

  const name = [
    partner.name,
    caption,
    `${onX(partner.href) ? "on X" : "website"} (opens in a new tab)`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <a
      href={partner.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={name}
      className={`${tile} transition-opacity duration-300 hover:opacity-90`}
    >
      {image}
      {label}
    </a>
  );
}
