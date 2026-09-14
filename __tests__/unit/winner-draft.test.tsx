/**
 * A saved draft is visible, loadable, and honestly labelled.
 *
 * The owner saved a Creator of the Week draft on the Winners screen, the form
 * cleared, and nothing anywhere showed the draft existed: the row sat in
 * weekly_winners with published_at null while the screen rendered a blank
 * form. They came back and concluded it was lost. These render the real panel
 * and walk that exact path.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WinnersPanel } from "@/components/admin/winners-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const CANDIDATE = {
  enrolmentId: "11111111-1111-1111-1111-111111111111",
  name: "Amara Obi",
  points: 300,
  rank: 1,
};

function renderWithDraft() {
  return render(
    <WinnersPanel
      weekNo={1}
      creatorCandidates={[CANDIDATE]}
      favouriteCandidates={[CANDIDATE]}
      excludedCount={0}
      frozen
      vote={null}
      picked={[
        {
          weekNo: 1,
          category: "creator_of_week",
          enrolmentId: CANDIDATE.enrolmentId,
          name: "Amara Obi",
          prizeNaira: 300_000,
          note: "Carried the week on X",
          publishedAt: null,
        },
      ]}
    />,
  );
}

describe("a saved draft", () => {
  it("is visible, with the name and the amount", () => {
    renderWithDraft();
    // The rail pill is the one place the draft-saved status lives; the box
    // below it carries the name and the amount without restating it.
    expect(screen.getByText(/draft saved/i)).toBeTruthy();
    expect(screen.getByText(/Amara Obi, ₦300,000/)).toBeTruthy();
  });

  it("says plainly that it is not public and that saving replaces it", () => {
    renderWithDraft();
    expect(screen.getByText(/Not public/)).toBeTruthy();
    expect(screen.getByText(/replaces this draft/)).toBeTruthy();
  });

  it("loads into the form on one click", () => {
    renderWithDraft();
    fireEvent.click(screen.getByRole("button", { name: /load the draft/i }));

    // The picker is a combobox now; the loaded draft reads back as the
    // chosen creator's row, not a raw id.
    const picker = screen.getByLabelText("Creator") as HTMLInputElement;
    expect(picker.value).toContain("Amara Obi");
    const prize = screen.getByLabelText("Prize") as HTMLInputElement;
    expect(prize.value).toBe("300000");
  });

  it("a draft naming a creator the list no longer contains cannot be saved blind", () => {
    render(
      <WinnersPanel
        weekNo={1}
        creatorCandidates={[CANDIDATE]}
        favouriteCandidates={[CANDIDATE]}
        excludedCount={0}
        vote={null}
        frozen
        picked={[
          {
            weekNo: 1,
            category: "creator_of_week",
            enrolmentId: "99999999-9999-9999-9999-999999999999",
            name: "Gone Creator",
            prizeNaira: 300_000,
            note: null,
            publishedAt: null,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /load the draft/i }));

    // The picker cannot name the id, so the form must not be armed: an
    // invisible id travelling to the API is how the wrong person wins.
    const save = screen.getByRole("button", { name: /save as draft/i });
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not haunt the screen once published", () => {
    render(
      <WinnersPanel
        weekNo={1}
        creatorCandidates={[CANDIDATE]}
        favouriteCandidates={[CANDIDATE]}
        excludedCount={0}
        frozen
        vote={null}
        picked={[
          {
            weekNo: 1,
            category: "creator_of_week",
            enrolmentId: CANDIDATE.enrolmentId,
            name: "Amara Obi",
            prizeNaira: 300_000,
            note: null,
            publishedAt: "2026-09-20T18:00:00.000Z",
          },
        ]}
      />,
    );
    expect(screen.queryByText(/Draft saved/)).toBeNull();
  });
});
