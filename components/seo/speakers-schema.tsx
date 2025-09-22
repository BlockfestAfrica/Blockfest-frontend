import React from "react";

interface Speaker {
  name: string;
  jobTitle?: string;
  description?: string;
  image?: string;
  url?: string;
  sameAs?: string[];
}

interface SpeakersSchemaProps {
  speakers: Speaker[];
}

export function SpeakersSchema({ speakers }: SpeakersSchemaProps) {
  const speakersData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Blockfest Africa 2025 Speakers",
    description:
      "Industry leaders and Web3 experts speaking at Blockfest Africa 2025",
    numberOfItems: speakers.length,
    itemListElement: speakers.map((speaker, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Person",
        name: speaker.name,
        jobTitle: speaker.jobTitle,
        description: speaker.description,
        image: speaker.image,
        url: speaker.url,
        sameAs: speaker.sameAs,
        performerIn: {
          "@type": "Event",
          name: "Blockfest Africa 2025",
          startDate: "2025-10-11T08:30:00+01:00",
          location: {
            "@type": "Place",
            name: "Landmark Event Center",
            address: "Lagos, Nigeria",
          },
        },
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(speakersData) }}
    />
  );
}

// Individual Speaker Schema
interface SpeakerSchemaProps {
  speaker: Speaker;
}

export function SpeakerSchema({ speaker }: SpeakerSchemaProps) {
  const speakerData = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: speaker.name,
    jobTitle: speaker.jobTitle,
    description: speaker.description,
    image: speaker.image,
    url: speaker.url,
    sameAs: speaker.sameAs,
    performerIn: {
      "@type": "Event",
      name: "Blockfest Africa 2025",
      startDate: "2025-10-11T08:30:00+01:00",
      location: {
        "@type": "Place",
        name: "Landmark Event Center",
        address: "Lagos, Nigeria",
      },
      organizer: {
        "@type": "Organization",
        name: "Blockfest Africa",
      },
    },
    knowsAbout: [
      "Blockchain Technology",
      "Web3 Development",
      "Cryptocurrency",
      "DeFi",
      "NFTs",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(speakerData) }}
    />
  );
}
