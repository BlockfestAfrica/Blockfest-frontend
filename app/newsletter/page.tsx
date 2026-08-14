import type { Metadata } from "next";
import { ArrowUpRight, Mail } from "lucide-react";
import { getNewsletterPosts, SUBSTACK_URL } from "@/lib/newsletter";
import { SITE_URL } from "@/lib/seo-event";

export const metadata: Metadata = {
  title: "Newsletter | Blockf3st Africa",
  description:
    "Speaker announcements, agenda news and ticket deadlines from Blockf3st Africa. Read past issues and subscribe.",
  keywords: [
    "blockfest africa newsletter",
    "african web3 newsletter",
    "african tech newsletter",
    "blockfest updates",
  ],
  openGraph: {
    title: "Newsletter | Blockf3st Africa",
    description:
      "Speaker announcements, agenda news and ticket deadlines. Read past issues and subscribe.",
  },
  alternates: { canonical: `${SITE_URL}/newsletter` },
};

/**
 * The newsletter archive.
 *
 * Issues are pulled from the Substack RSS feed at request time and cached for
 * an hour, so publishing on Substack is the only step: a new issue shows up
 * here on its own, with no redeploy and nothing to edit.
 *
 * Cards link out rather than reproducing the issue. Substack's own page is
 * where subscribing happens, and republishing the body here would have meant
 * pointing canonical at Substack anyway — so the page would carry the cost of
 * duplicated content without earning the search value.
 */
export default async function NewsletterPage() {
  const posts = await getNewsletterPosts();
  // Newest gets the featured treatment; the rest are the archive. Repeating the
  // latest in both places on one screen reads as a bug rather than emphasis.
  const [latest, ...earlier] = posts;

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw script injection
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Blockf3st Africa Newsletter",
            url: `${SITE_URL}/newsletter`,
            description:
              "Speaker announcements, agenda news and ticket deadlines from Blockf3st Africa.",
            hasPart: posts.slice(0, 10).map((post) => ({
              "@type": "NewsArticle",
              headline: post.title,
              datePublished: post.date,
              url: post.url,
              ...(post.coverImage ? { image: post.coverImage } : {}),
            })),
          }),
        }}
      />

      <main id="main">
        <section className="section-y bg-ground">
          <div className="container-page">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-16">
              <div className="max-w-2xl">
                <p className="eyebrow text-white/60">The newsletter</p>
                <h1 className="text-display-sm mt-3 font-bold text-white">
                  Everything before everyone else
                </h1>
                <p className="mt-4 text-base leading-relaxed text-white/60">
                  Speaker announcements, agenda news and ticket deadlines, sent
                  to more than 11,000 people across the continent. Free, and no
                  more often than we have something worth saying.
                </p>
              </div>

              <div className="w-full max-w-[480px] overflow-hidden rounded-xl lg:w-[420px]">
                <iframe
                  src={`${SUBSTACK_URL}/embed`}
                  title="Subscribe to the Blockf3st Africa newsletter"
                  width={480}
                  height={320}
                  scrolling="no"
                  className="block h-[320px] w-full border-0 bg-white"
                />
              </div>
            </div>
          </div>
        </section>

        {/* The most recent issue, given its own treatment. Someone landing here
            should be able to read the newest thing without working out which
            row of a list is newest. */}
        {latest && (
          <section className="section-y bg-ground border-t border-white/20">
            <div className="container-page">
              <a
                href={latest.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group grid grid-cols-1 gap-6 rounded-xl border border-brand-blue bg-white/10 p-5 transition-colors duration-300 hover:bg-white/20 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:p-8"
              >
                {latest.coverImage ? (
                  <img
                    src={latest.coverImage}
                    alt=""
                    width={640}
                    height={360}
                    className="aspect-video w-full rounded-lg border border-white/20 bg-brand-blue/15 object-cover lg:order-2"
                  />
                ) : (
                  <span
                    className="flex aspect-video w-full items-center justify-center rounded-lg border border-white/20 bg-brand-blue/15 text-brand-blue-light lg:order-2"
                    aria-hidden="true"
                  >
                    <Mail className="h-8 w-8" />
                  </span>
                )}

                <div className="min-w-0 lg:order-1">
                  <span className="eyebrow inline-flex rounded-full bg-brand-gold px-3 py-1 text-black">
                    Latest issue
                  </span>
                  <p className="eyebrow mt-4 text-white/60">
                    <time dateTime={latest.date}>{latest.displayDate}</time>
                    {" · "}
                    {latest.readingMinutes} min read
                  </p>
                  <h2 className="text-display-sm mt-2 font-bold text-white">
                    {latest.title}
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-white/60">
                    {latest.longExcerpt}
                  </p>
                  <span className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-gold px-6 text-sm font-semibold text-black transition-colors group-hover:bg-brand-gold-hover">
                    Read this issue
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              </a>
            </div>
          </section>
        )}

        <section className="section-y bg-ground border-t border-white/20">
          <div className="container-page">
            <h2 className="text-display-sm mb-10 font-bold text-white lg:mb-14">
              Past issues
            </h2>

            {earlier.length === 0 ? (
              <div className="rounded-xl border border-white/20 bg-white/5 p-6">
                <p className="text-base leading-relaxed text-white/60">
                  {posts.length === 0
                    ? "Past issues are not loading right now. "
                    : "This is the first issue. Earlier ones will appear here. "}
                  <a
                    href={SUBSTACK_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link underline underline-offset-2 hover:text-white"
                  >
                    {posts.length === 0
                      ? "Read them on Substack"
                      : "Visit the Substack"}
                  </a>
                  .
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-6">
                {earlier.map((post, index) => (
                  <li key={post.url}>
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group grid grid-cols-1 gap-5 rounded-xl border border-white/20 bg-white/5 p-5 transition-colors duration-300 hover:bg-white/10 sm:grid-cols-[200px_1fr] sm:items-start sm:gap-6 sm:p-6"
                    >
                      {post.coverImage ? (
                        <img
                          src={post.coverImage}
                          alt=""
                          width={640}
                          height={360}
                          loading={index < 2 ? "eager" : "lazy"}
                          // A cover that fails at Substack's CDN degrades to a branded tile
                          // rather than a broken-image icon.
                          className="aspect-video w-full rounded-lg border border-white/20 bg-brand-blue/15 object-cover"
                        />
                      ) : (
                        <span
                          className="flex aspect-video w-full items-center justify-center rounded-lg border border-white/20 bg-brand-blue/15 text-brand-blue-light"
                          aria-hidden="true"
                        >
                          <Mail className="h-6 w-6" />
                        </span>
                      )}

                      <div className="min-w-0">
                        <p className="eyebrow text-white/60">
                          <time dateTime={post.date}>{post.displayDate}</time>
                          {" · "}
                          {post.readingMinutes} min read
                        </p>
                        <h3 className="mt-2 text-lg font-bold text-white lg:text-2xl">
                          {post.title}
                        </h3>
                        <p className="mt-3 text-sm leading-relaxed text-white/60 lg:text-base">
                          {post.excerpt}
                        </p>
                        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue-light group-hover:text-white">
                          Read on Substack
                          <ArrowUpRight
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </span>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-10 text-sm text-white/60">
              Every issue lives on{" "}
              <a
                href={SUBSTACK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link underline underline-offset-2 hover:text-white"
              >
                blockfest.substack.com
              </a>
              .
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
