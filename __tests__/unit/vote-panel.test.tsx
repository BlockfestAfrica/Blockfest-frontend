import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VotePanel } from "@/components/campaigns/vote-panel";

/*
 * The vote panel's words.
 *
 * Two rules. What the panel writes itself is the same for every voter and
 * says the rule up front: one vote per address each round, and a confirmed
 * vote cannot be changed. What the server answers is shown exactly as sent,
 * because that answer is uniform on purpose and a panel that rewrote it
 * could undo the uniformity.
 */

const SERVER =
  "If this address has not confirmed a vote in this round yet, a six digit code is on its way to its inbox. If it has, no new code will come and there is nothing more to do: a confirmed vote cannot be changed.";

const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ ok: true, message: SERVER }),
}));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("VotePanel", () => {
  it("says the rule before anybody asks for a code", () => {
    render(<VotePanel roundId="r" nomineeId="n" nomineeName="Ada Obi" />);
    fireEvent.click(screen.getByRole("button", { name: "Vote for Ada Obi" }));
    expect(document.body.textContent).toContain(
      "One vote per email address each round. We send a six digit code to confirm it, and a confirmed vote cannot be changed.",
    );
  });

  it("shows the server's answer to a cast word for word", async () => {
    render(<VotePanel roundId="r" nomineeId="n" nomineeName="Ada Obi" />);
    fireEvent.click(screen.getByRole("button", { name: "Vote for Ada Obi" }));
    fireEvent.change(screen.getByLabelText("Your email address"), {
      target: { value: "ada@example.com" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
    });
    expect(screen.getByText(SERVER)).toBeTruthy();
    expect(screen.getByLabelText("Six digit code")).toBeTruthy();
  });
});
