/**
 * Nothing is drafted or announced on the winners screen without a last look.
 *
 * The two prizes sit one tab apart in the same form, and the owner asked that
 * no admin could announce the wrong one by mistake. Save as draft and
 * Announce both open a modal that names the award, the week, the creator and
 * the prize, and says which award this is not. Announcing also needs a tick.
 * These render the real panel and walk each path to the request it sends.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WinnersPanel, type VoteVerdict } from "@/components/admin/winners-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const AMARA = {
  enrolmentId: "11111111-1111-1111-1111-111111111111",
  name: "Amara Obi",
  points: 300,
  rank: 1,
};
const BISI = {
  enrolmentId: "22222222-2222-2222-2222-222222222222",
  name: "Bisi Ade",
  points: 200,
  rank: 2,
};

const DECIDED: VoteVerdict = {
  state: "decided",
  votes: 12,
  winner: { enrolmentId: BISI.enrolmentId, name: BISI.name, votes: 12 },
  nomineeEnrolmentIds: [AMARA.enrolmentId, BISI.enrolmentId],
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, emailed: true }),
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function panel(props: Partial<Parameters<typeof WinnersPanel>[0]> = {}) {
  return render(
    <WinnersPanel
      weekNo={2}
      creatorCandidates={[AMARA, BISI]}
      favouriteCandidates={[AMARA, BISI]}
      excludedCount={0}
      frozen
      vote={DECIDED}
      picked={[]}
      {...props}
    />,
  );
}

function pickAmara() {
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "amara" } });
  fireEvent.mouseDown(screen.getByRole("option", { name: /Amara Obi/ }));
}

function switchTo(prize: "Creator of the Week" | "Community Favourite") {
  fireEvent.click(screen.getByRole("button", { name: prize }));
}

const sent = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

describe("announcing Creator of the Week", () => {
  it("names the award, the week, the creator and the prize, and the award it is not", () => {
    panel();
    pickAmara();
    fireEvent.click(
      screen.getByRole("button", { name: "Announce Creator of the Week…" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Announce the week 2 Creator of the Week?",
    });
    expect(within(dialog).getByText("Amara Obi")).toBeTruthy();
    expect(within(dialog).getByText("₦300,000")).toBeTruthy();
    expect(within(dialog).getByText("Week 2")).toBeTruthy();
    expect(
      within(dialog).getByText(
        /This is Creator of the Week, the Blockfest team's pick\. It is not the Community Favourite\./,
      ),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("will not announce until the tick is given, then sends a publish", async () => {
    panel();
    pickAmara();
    fireEvent.click(
      screen.getByRole("button", { name: "Announce Creator of the Week…" }),
    );

    const yes = screen.getByRole("button", {
      name: "Yes, announce the Creator of the Week",
    }) as HTMLButtonElement;
    expect(yes.disabled).toBe(true);

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I have checked that Amara Obi is the week 2 Creator of the Week.",
      }),
    );
    expect(yes.disabled).toBe(false);
    fireEvent.click(yes);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent()).toMatchObject({
      weekNo: 2,
      category: "creator_of_week",
      enrolmentId: AMARA.enrolmentId,
      prizeNaira: 300_000,
      publish: true,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("puts focus on Cancel, so Enter never announces", () => {
    panel();
    pickAmara();
    fireEvent.click(
      screen.getByRole("button", { name: "Announce Creator of the Week…" }),
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );
  });

  it("sends nothing on Cancel", () => {
    panel();
    pickAmara();
    fireEvent.click(
      screen.getByRole("button", { name: "Announce Creator of the Week…" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("announcing the Community Favourite", () => {
  it("says it is the vote's prize, not Creator of the Week, and that nominees hear", () => {
    panel();
    switchTo("Community Favourite");
    fireEvent.click(
      screen.getByRole("button", { name: "Announce Community Favourite…" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Announce the week 2 Community Favourite?",
    });
    expect(within(dialog).getByText("Bisi Ade")).toBeTruthy();
    expect(
      within(dialog).getByText(
        /This is the Community Favourite, the prize the public vote decides\. It is not Creator of the Week\./,
      ),
    ).toBeTruthy();
    expect(
      within(dialog).getByText(/The other nominees are told the result/),
    ).toBeTruthy();
  });

  it("sends the vote's winner under the right award", async () => {
    panel();
    switchTo("Community Favourite");
    fireEvent.click(
      screen.getByRole("button", { name: "Announce Community Favourite…" }),
    );
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Yes, announce the Community Favourite",
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent()).toMatchObject({
      category: "community_favourite",
      enrolmentId: BISI.enrolmentId,
      publish: true,
    });
  });

  it("asks for the tick again each time it opens", () => {
    panel();
    switchTo("Community Favourite");
    const open = () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Announce Community Favourite…" }),
      );
    open();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    open();

    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });
});

describe("saving a draft", () => {
  it("confirms the award first, needs no tick, and sends publish false", async () => {
    panel();
    pickAmara();
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));

    const dialog = screen.getByRole("dialog", {
      name: "Save the week 2 Creator of the Week as a draft?",
    });
    expect(within(dialog).getByText(/Nothing goes public/)).toBeTruthy();
    expect(within(dialog).queryByRole("checkbox")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Yes, save the draft" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sent()).toMatchObject({
      category: "creator_of_week",
      enrolmentId: AMARA.enrolmentId,
      publish: false,
    });
  });

  it("names the saved draft it replaces", () => {
    panel({
      picked: [
        {
          weekNo: 2,
          category: "creator_of_week",
          enrolmentId: BISI.enrolmentId,
          name: "Bisi Ade",
          prizeNaira: 300_000,
          note: null,
          publishedAt: null,
        },
      ],
    });
    pickAmara();
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));

    expect(
      within(screen.getByRole("dialog")).getByText(
        /It replaces the saved draft \(Bisi Ade, ₦300,000\)\./,
      ),
    ).toBeTruthy();
  });

  it("says it updates, not replaces, a draft for the same creator", () => {
    panel({
      picked: [
        {
          weekNo: 2,
          category: "creator_of_week",
          enrolmentId: AMARA.enrolmentId,
          name: "Amara Obi",
          prizeNaira: 300_000,
          note: null,
          publishedAt: null,
        },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /load the draft/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/It updates the saved draft for Amara Obi\./)).toBeTruthy();
    expect(within(dialog).queryByText(/replaces/)).toBeNull();
  });

  it("stays open with the choice intact when the server refuses", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, message: "Not allowed." }),
    });
    panel();
    pickAmara();
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, save the draft" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      within(screen.getByRole("dialog")).getByText("Amara Obi"),
    ).toBeTruthy();
  });
});
