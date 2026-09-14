/**
 * The campaign's own voice, from the marketing team, word for word.
 *
 * This is the intro they wrote and signed off, so it renders as copy rather
 * than being paraphrased into interface prose: short declarative lines, a
 * turn ("You are."), and the question the whole campaign hangs on. Between
 * the hero and how-it-works, because it is the WHY that earns the reader the
 * HOW below it.
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

          <div className="mt-6 space-y-4 text-base leading-relaxed text-ink-2">
            <p>
              A story about how we earn it, move it, send it, receive it, spend
              it, and sometimes struggle to get it where it needs to go.
            </p>
            <p>
              Monica has a story too. But this time, we are not telling you the
              story.
            </p>
            <p className="text-xl font-bold text-white">You are.</p>
            <p>
              For the next five weeks, creators will take on weekly challenges
              designed to test four skills: Storytelling, Creativity, Education
              and Influence.
            </p>
            <p>How you tell the story is entirely up to you.</p>
            <p>
              Make us laugh. Make us think. Teach us something. Show us
              something we have never seen before.
            </p>
            <p className="font-semibold text-white">
              There is &#8358;5,000,000 on the line.
            </p>
            <p className="text-ink-3">The question is simple:</p>
            <p className="text-2xl font-bold text-brand-gold">
              Are you skillful?
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
