import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Blockfest Africa",
    short_name: "Blockfest",
    description:
      "Africa's premier blockchain conference bringing together builders, founders, investors, and enthusiasts to shape the future of Web3 in Africa.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f0f23",
    theme_color: "#7c3aed",
    orientation: "portrait-primary",
    categories: ["business", "technology", "finance", "blockchain"],
    lang: "en-US",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/screenshot-wide.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
      },
      {
        src: "/screenshot-narrow.png",
        sizes: "720x1280",
        type: "image/png",
        form_factor: "narrow",
      },
    ],
  };
}
