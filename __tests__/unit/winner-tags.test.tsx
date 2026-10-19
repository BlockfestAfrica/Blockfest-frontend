/**
 * The owner's list of every Monica winner and the tag each prize is paid to.
 *
 * What it must do: copy the exact tag of the row pressed, copy the whole list
 * as a table a sheet splits into columns, and make a win with no tag
 * impossible to miss and easy to chase.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { toast } from "sonner";
import { WinnerTags, winnersAsTable, type WinnerTagRow } from "@/components/admin/winner-tags";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const writeText = vi.fn(async (text: string) => {
  void text;
});

beforeEach(() => {
  writeText.mockClear();
  writeText.mockImplementation(async () => {});
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});
afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

const WINS: WinnerTagRow[] = [
  { weekNo: 1, category: "creator_of_week", name: "Ada Obi", monicaTag: "ada.obi", email: "ada@example.test", prizeNaira: 100000 },
  { weekNo: 1, category: "community_favourite", name: "Bola Ade", monicaTag: "bola_ade", email: "bola@example.test", prizeNaira: 50000 },
  { weekNo: 2, category: "creator_of_week", name: "Chi Eze", monicaTag: null, email: "chi@example.test", prizeNaira: 100000 },
  { weekNo: 2, category: "community_favourite", name: "Bola Ade", monicaTag: "bola_ade", email: "bola@example.test", prizeNaira: 50000 },
];

describe("the winners list", () => {
  it("says where it stands once: how many wins, the total, and how many have no tag", () => {
    render(<WinnerTags winners={WINS} />);
    expect(
      screen.getByText(/4 wins, ₦300,000 in prizes, each paid to the Monica tag the winner registered with\. One has no tag yet\./),
    ).toBeTruthy();
  });

  it("groups the wins by week, each leading with the name and saying the award and prize", () => {
    render(<WinnerTags winners={WINS} />);
    const week1 = screen.getByRole("group", { name: "Week 1" });
    expect(within(week1).getByText("Ada Obi")).toBeTruthy();
    expect(within(week1).getByText("Creator of the Week · ₦100,000")).toBeTruthy();
    expect(within(week1).getByText("Community Favourite · ₦50,000")).toBeTruthy();
    // A creator who won twice is paid twice, so is listed twice.
    expect(screen.getAllByText("Bola Ade")).toHaveLength(2);
  });

  it("copies the exact tag of the row pressed", async () => {
    render(<WinnerTags winners={WINS} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Copy Ada Obi's Monica tag, ada.obi (week 1 Creator of the Week)" }),
    );
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("ada.obi"));
    expect(toast.success).toHaveBeenCalledWith("Copied ada.obi");
    expect(
      await screen.findByRole("button", { name: "Copy Ada Obi's Monica tag, ada.obi (week 1 Creator of the Week)" }),
    ).toHaveProperty("textContent", "Copied");
  });

  it("copies every win as a table", async () => {
    render(<WinnerTags winners={WINS} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy every winner as a table, for a spreadsheet" }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(winnersAsTable(WINS)));
    expect(toast.success).toHaveBeenCalledWith("Copied 4 winners");
  });

  it("marks a win with no tag on its edge, gives the address to ask, and offers nothing to copy", () => {
    render(<WinnerTags winners={WINS} />);
    const row = screen.getByText("Chi Eze").closest("li")!;
    expect(row.className).toContain("border-l-amber-400");
    expect(within(row).getByText(/No Monica tag on their registration/)).toBeTruthy();
    expect(within(row).getByRole("link", { name: "chi@example.test" }).getAttribute("href")).toBe(
      "mailto:chi@example.test",
    );
    expect(within(row).queryByRole("button")).toBeNull();
    // A row with a tag has no edge colour.
    expect(screen.getByText("Ada Obi").closest("li")!.className).toContain("border-l-transparent");
  });

  it("says so when the clipboard is refused, rather than appearing to work", async () => {
    writeText.mockImplementation(async () => {
      throw new Error("denied");
    });
    render(<WinnerTags winners={WINS} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy every winner as a table, for a spreadsheet" }));
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Could not copy. Select the text and copy it by hand."),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says nobody has won yet, with no copy button, before the first announcement", () => {
    render(<WinnerTags winners={[]} />);
    expect(screen.getByText("Nobody has been announced yet.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the table it copies", () => {
  it("is a header row then one tab-separated row per win, the prize as digits", () => {
    expect(winnersAsTable(WINS).split("\n")).toEqual([
      "Week\tAward\tName\tMonica tag\tPrize (NGN)",
      "1\tCreator of the Week\tAda Obi\tada.obi\t100000",
      "1\tCommunity Favourite\tBola Ade\tbola_ade\t50000",
      "2\tCreator of the Week\tChi Eze\t(no tag)\t100000",
      "2\tCommunity Favourite\tBola Ade\tbola_ade\t50000",
    ]);
  });

  it("never lets a name break the columns", () => {
    const [, row] = winnersAsTable([{ ...WINS[0], name: "Ada\tObi\nJr" }]).split("\n");
    expect(row.split("\t")).toEqual(["1", "Creator of the Week", "Ada Obi Jr", "ada.obi", "100000"]);
  });
});
