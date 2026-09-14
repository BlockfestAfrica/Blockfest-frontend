/**
 * The campaign's own voice, from the marketing team, word for word.
 *
 * The words are theirs verbatim; the line breaks are not. Rendering every
 * sentence as its own paragraph read as a vertical list, so the copy flows
 * as three paragraphs with the turn ("You are.") and the closing question
 * kept as the two moments of emphasis. Between the hero and how-it-works,
 * because it is the WHY that earns the reader the HOW below it.
 */
export function MonicaIntro() {
  return (
    <section
      aria-labelledby="intro-heading"
      className="section-y border-t border-line-2 bg-ground"
    >
      <div className="container-page">
        <div className="max-w-2xl">
          <h2 id="intro-heading" className="text-display-sm font-bold text-white">
            Money has a story.
          </h2>

          <div className="mt-6 space-y-5 text-base leading-relaxed text-ink-2">
            <p>
              A story about how we earn it, move it, send it, receive it, spend
              it, and sometimes struggle to get it where it needs to go. Monica
              has a story too. But this time, we're not telling you the story.{" "}
              <span className="font-bold text-white">You are.</span>
            </p>
            <p>
              For the next five weeks, creators will take on weekly challenges
              designed to test four skills: Storytelling, Creativity, Education
              and Influence. How you tell the story is entirely up to you. Make
              us laugh. Make us think. Teach us something. Show us something
              we've never seen before.
            </p>
            <p className="font-semibold text-white">
              There is &#8358;5,000,000 on the line.{" "}
              <span className="font-normal text-ink-3">
                The question is simple:
              </span>
            </p>
            <p className="text-2xl font-bold text-brand-gold">
              Are you skillful?
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
