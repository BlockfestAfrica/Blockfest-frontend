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

  /*
   * Image optimization for mobile devices, bounded to what the pages ask for.
   *
   * /_next/image is public and reads url, w and q from the query string, and
   * every combination it has not seen is a cache miss that decodes the whole
   * source and encodes it again. Much of public/ is committed at full
   * resolution, speaker photos up to 31 megapixels and one partner logo on
   * the home page at 107, so with nothing listed an anonymous visitor could
   * ask for thousands of full transforms of one file: any q from 1 to 100,
   * any path on the site, and any query string on the end of it, each one a
   * new cache key for the same bytes.
   *
   * The keys below close that on Next's own optimizer, which is what answers
   * under next start and next dev, and Next 16 requires qualities anyway.
   * Where the Netlify runtime hands /_next/image to the platform's image
   * service instead, that service applies its own rules, and the bound there
   * is the size of the files themselves: an image is resized before it is
   * committed, as scripts/optimize-sa-photos.mjs does for one gallery, rather
   * than left to this block.
   *
   * __tests__/unit/image-optimizer-bounds.test.ts runs every quality and image
   * path the pages render through Next's validation, so a component that
   * needs a new one fails the suite, and the deploy, until it is listed here.
   */
  images: {
    /*
     * WebP only. With AVIF listed, any request whose Accept header names
     * image/avif, which every current browser's does, got the AVIF encoder,
     * the slowest one sharp has, on every miss.
     */
    formats: ["image/webp"],
    deviceSizes: [320, 420, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    /*
     * 60 on the home hero, 85 on the speaker grids, and 75, which is what
     * next/image sends for every component that sets no quality. Any other q
     * is now a 400 rather than a fresh transform.
     */
    qualities: [60, 75, 85],
    /*
     * Everything rendered through next/image lives under these two
     * directories. search: "" refuses a query string outright, which is what
     * turned the variant count from large into unbounded. Next adds
     * /_next/static/media/** by itself for statically imported images.
     */
    localPatterns: [
      { pathname: "/images/**", search: "" },
      { pathname: "/2026/**", search: "" },
    ],
    minimumCacheTTL: 31536000, // 1 year cache
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    domains: [],
  },

  // Security headers
  async headers() {
    const isDev = process.env.NODE_ENV === "development";

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
            /*
             * 'unsafe-eval' is gone in production, and so is the vendor host
             * from script-src: the analytics tag is served from this origin
             * as a pinned snapshot (public/vendor/script.js), so NO external
             * host may execute script anywhere on the site in production.
             * The vendor stays in connect-src only, which is receiving
             * beacons, not running code.
             *
             * Dev-only exception: next dev's Fast Refresh / HMR client uses
             * eval() for its source maps, which this policy was blocking
             * locally (blank carousel, dead client components). isDev is
             * false on every deployed build — the host sets
             * NODE_ENV=production for `next build` — so this widens nothing
             * that ships. The vulnerability this header defends against
             * (#138: eval + a same-origin script tag reaching an admin's
             * Netlify Identity token) requires a script actually running on
             * a live, authenticated session; a local dev server on your own
             * machine isn't that surface.
             *
             * What this still cannot fix is the shape of the problem in
             * #138. That needs the console moved off this origin or the
             * Identity token exchanged server-side behind an httpOnly
             * cookie. Tracked there, not here.
             */
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://www.sabilytics.com${isDev ? " ws:" : ""}; frame-src 'self' https://blockfest.substack.com; frame-ancestors 'none';`,
          },
        ],
      },
      {
        /*
         * A second, tighter policy for the admin surface.
         *
         * A browser enforces the INTERSECTION of every Content-Security-Policy
         * header it receives, so this genuinely narrows the one above rather
         * than replacing it. On these paths the vendor analytics host is not an
         * allowed script source or connect target, and 'unsafe-eval' is gone —
         * including in dev, on purpose: this is the block directly guarding
         * #138, so it doesn't get the same dev carve-out as the main policy
         * above unless you hit the same local-breakage symptom here too.
         *
         * This is the second layer. components/shared/analytics.tsx already
         * refuses to render the tag here, and this is what holds if somebody
         * moves it back into the layout while tidying up. A third-party script
         * on an authenticated admin page does not need to steal anything: a
         * same-origin fetch to /api/admin/review carries the session cookie and
         * a browser-set Origin, so every server-side check passes and the
         * approvals are recorded against the real reviewer.
         *
         * 'unsafe-inline' stays, and that is not an oversight. Next emits its
         * own inline hydration scripts, so removing it needs a nonce threaded
         * through middleware, which is a day of work and a separate change. The
         * vendor host and eval are the two that matter for this attack.
         */
        source: "/admin/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';",
          },
          {
            // Nothing on the admin surface should ever be stored by a shared
            // cache or an intermediary.
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, private",
          },
        ],
      },
      {
        /*
         * The same tightening, for the pages that can carry a creator's token.
         *
         * /enter receives it in the query by definition, and the platform
         * re-appends that query to the redirect, so /enter/confirm and /me can
         * both be loaded with the token in the address bar. Any third party
         * script running there reads it from location.search and has a ninety
         * day session for that creator.
         *
         * components/shared/analytics.tsx already refuses to render the tag on
         * these paths. This is the layer that holds if somebody removes that
         * check, because the browser will not fetch the script at all.
         */
        source: "/campaigns/monica-money-story/enter/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';",
          },
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, private",
          },
          {
            // Belt for the Referer, so the token cannot ride out on an
            // outbound click either.
            key: "Referrer-Policy",
            value: "no-referrer",
          },
        ],
      },
      {
        source: "/campaigns/monica-money-story/me",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';",
          },
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, private",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
        ],
      },
      {
        /*
         * The same tightening again, for the same reason: /recover/open
         * carries the recovery token in its query the way /enter carries
         * the entry token, and /recover/confirm can be loaded with it still
         * in the address bar once the platform re-appends the query on
         * redirect.
         */
        source: "/campaigns/monica-money-story/recover/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';",
          },
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, private",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
        ],
      },
      {
        // One creator's own rank and name, read from their cookie. The route
        // sets this itself on every response; this is the second layer.
        source: "/api/campaigns/monica/standing",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, private",
          },
        ],
      },
      {
        source: "/api/admin/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none';",
          },
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, private",
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
        /*
         * /register is the obvious word, so somebody will link a creator to it
         * on launch day. It used to bounce them to the homepage, and as a 308
         * that answer is cached by the browser indefinitely: the breakage
         * survived the fix for everybody who hit it once.
         *
         * Now it lands where they were trying to go, and 307 so a later change
         * of mind is not permanent for anybody who followed it.
         */
        source: "/register",
        destination: "/campaigns/monica-money-story/register",
        permanent: false,
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