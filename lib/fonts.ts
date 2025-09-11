import localFont from "next/font/local";

// Centralized font configuration for better performance
export const gotham = localFont({
  src: "../app/fonts/Gotham-Medium.otf",
  display: "swap",
  variable: "--font-gotham",
  preload: true,
});

export const gothamThin = localFont({
  src: "../app/fonts/Gotham-Thin.otf",
  display: "swap",
  variable: "--font-gotham-thin",
  preload: false, // Load on demand
});
