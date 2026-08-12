"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus } from "lucide-react";

export interface GalleryPhoto {
  src: string;
  width: number;
  height: number;
}

/**
 * Masonry gallery that opens with a manageable set.
 *
 * The South Africa recap ships 54 photographs. Rendered in one mobile column
 * that was 27 screens of scrolling — the page was 30.5 screens end to end and
 * almost all of it was this. Phones now start with a dozen in two columns and
 * the rest are one tap away.
 */
export function PhotoGallery({
  photos,
  altPrefix,
  initialCount = 12,
}: {
  photos: readonly GalleryPhoto[];
  altPrefix: string;
  initialCount?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? photos : photos.slice(0, initialCount);
  const remaining = photos.length - visible.length;

  return (
    <>
      <div className="columns-2 gap-3 sm:gap-4 lg:columns-3 lg:gap-5 [column-fill:_balance]">
        {visible.map((photo, index) => (
          <div
            key={photo.src}
            className="group mb-3 break-inside-avoid overflow-hidden rounded-xl border border-gray-200 bg-paper-muted sm:mb-4 lg:mb-5"
          >
            <Image
              src={photo.src}
              alt={`${altPrefix}, photo ${index + 1}`}
              width={photo.width}
              height={photo.height}
              loading={index < 4 ? "eager" : "lazy"}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
              className="h-auto w-full"
            />
          </div>
        ))}
      </div>

      {remaining > 0 && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gray-200 bg-white px-7 text-sm font-semibold text-gray-900 transition-colors hover:border-brand-blue"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Show all {photos.length} photos
          </button>
        </div>
      )}
    </>
  );
}
