import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A production build and a running `npm run dev` cannot share one output
  // directory: the build replaces chunks the dev server still has open and
  // every route starts throwing MODULE_NOT_FOUND until dev is restarted.
  // Set NEXT_DIST_DIR to build somewhere else while dev keeps running, e.g.
  //   NEXT_DIST_DIR=.next-build npx next build
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Enable experimental features for better SEO
  experimental: {
    optimizePackageImports: ["lucide-react", "react-icons"],
    // The stylesheet is the single largest thing gating first paint: blocking
    // it in a test dropped LCP from 1700ms to 592ms at 600kbps. Its cost is the
    // extra round trip, not its contents (92.8% of the rules are used), so
    // inline it rather than trying to purge it.
    inlineCss: true,
  },

  // Image optimization for mobile devices
  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: [320, 420, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year cache
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    domains: [],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.sabilytics.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://www.sabilytics.com; frame-src 'self' https://blockfest.substack.com; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },

  // Redirects for SEO
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
      // Legacy HTML paths redirect to home
      {
        source: "/about.html",
        destination: "/",
        permanent: true,
      },
      {
        source: "/index.html",
        destination: "/",
        permanent: true,
      },
      {
        source: "/home.html",
        destination: "/",
        permanent: true,
      },
      {
        source: "/speakers.html",
        destination: "/",
        permanent: true,
      },
      {
        source: "/contact.html",
        destination: "/",
        permanent: true,
      },
      {
        source: "/sponsors.html",
        destination: "/",
        permanent: true,
      },
      // Common old paths
      {
        source: "/about",
        destination: "/",
        permanent: true,
      },
      {
        source: "/contact",
        destination: "/",
        permanent: true,
      },

      {
        source: "/register",
        destination: "/",
        permanent: true,
      },
    ];
  },

  // Rewrites for clean URLs
  async rewrites() {
    return [
      {
        source: "/sitemap",
        destination: "/sitemap.xml",
      },
    ];
  },
};

export default nextConfig;
