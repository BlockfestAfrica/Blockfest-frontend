import Image from "next/image";

const photos = [
  {
    src: "/images/south-africa/gallery/sa-08.webp",
    alt: "Blockfest Africa community gathered in Cape Town",
  },
  {
    src: "/images/south-africa/gallery/sa-05.webp",
    alt: "Roadshow attendee in colourful Bo-Kaap, Cape Town",
  },
  {
    src: "/images/south-africa/gallery/sa-20.webp",
    alt: "Blockfest attendee at a Cape Town viewpoint",
  },
  {
    src: "/images/south-africa/gallery/sa-13.webp",
    alt: "Roadshow attendees on the streets of Cape Town",
  },
  {
    src: "/images/south-africa/gallery/sa-42.webp",
    alt: "Cape Town roadshow scene",
  },
  {
    src: "/images/south-africa/gallery/sa-01.webp",
    alt: "Welcome to Blockfest Africa Roadshow, Cape Town 2026",
  },
];

export function SocialProofStrip() {
  return (
    <section className="relative w-full overflow-hidden border-t border-white/20 bg-ground">
      <div className="grid grid-cols-3 md:grid-cols-6">
        {photos.map((photo) => (
          <div key={photo.src} className="relative aspect-square overflow-hidden">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(max-width: 768px) 33vw, 16.67vw"
              loading="lazy"
              className="object-cover object-center transition-transform duration-500 hover:scale-105"
            />
          </div>
        ))}
      </div>
      {/* Image scrim: keeps the caption legible over the photography. */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ground/90 via-transparent to-ground/60"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center lg:px-8">
        <p className="eyebrow text-white/90">
          South Africa roadshow · next stop Lagos
        </p>
      </div>
    </section>
  );
}
