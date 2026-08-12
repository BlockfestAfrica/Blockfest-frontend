import Image from "next/image";

const photos = [
  { src: "/images/south-africa/gallery/sa-08.webp", alt: "Blockfest Africa community gathered in Cape Town" },
  { src: "/images/south-africa/gallery/sa-05.webp", alt: "Roadshow attendee in colourful Bo-Kaap, Cape Town" },
  { src: "/images/south-africa/gallery/sa-20.webp", alt: "Blockfest attendee at a Cape Town viewpoint" },
  { src: "/images/south-africa/gallery/sa-13.webp", alt: "Roadshow attendees on the streets of Cape Town" },
  { src: "/images/south-africa/gallery/sa-42.webp", alt: "Cape Town roadshow scene" },
  { src: "/images/south-africa/gallery/sa-01.webp", alt: "Welcome to Blockfest Africa Roadshow, Cape Town 2026" },
];

export function SocialProofStrip() {
  return (
    <section className="relative w-full overflow-hidden bg-black">
      <div className="grid grid-cols-3 md:grid-cols-6">
        {photos.map((photo) => (
          <div
            key={photo.src}
            className="relative aspect-square overflow-hidden"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(max-width: 768px) 33vw, 16.67vw"
              loading="lazy"
              className="object-cover object-center hover:scale-105 transition-transform duration-500"
            />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/60 pointer-events-none" />
      <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
        <p className="text-white/60 text-xs sm:text-sm font-medium tracking-wider uppercase">
          Fresh from the South Africa roadshow · next stop Lagos
        </p>
      </div>
    </section>
  );
}
