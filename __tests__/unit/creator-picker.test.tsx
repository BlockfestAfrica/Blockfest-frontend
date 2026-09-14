/**
 * The creator combobox stays usable at three hundred names.
 *
 * The announce card's native select was fine at launch and unusable by
 * ambition: a long campaign means a long list, and scrolling an OS option
 * list for one person is how the wrong row gets clicked. These pin the
 * behaviours that make search trustworthy: filtering, the keep-typing
 * overflow line, keyboard selection, and the chosen name reading back.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreatorPicker } from "@/components/admin/creator-picker";

const many = Array.from({ length: 12 }, (_, i) => ({
  enrolmentId: `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`,
  name: i === 0 ? "Amara Obi" : `Creator ${i}`,
  points: 500 - i * 10,
  rank: i + 1,
}));

function renderPicker(value = "", onChange = vi.fn()) {
  render(
    <CreatorPicker id="winner" candidates={many} value={value} onChange={onChange} />,
  );
  return onChange;
}

describe("the creator picker", () => {
  it("filters to the typed name", () => {
    renderPicker();
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "amara" } });

    expect(screen.getByRole("option", { name: /Amara Obi/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Creator 3/ })).toBeNull();
  });

  it("caps the open list and says how many more are hiding", () => {
    renderPicker();
    fireEvent.focus(screen.getByRole("combobox"));

    expect(screen.getAllByRole("option")).toHaveLength(8);
    expect(screen.getByText(/4 more matches/)).toBeTruthy();
  });

  it("picks on click and reads the choice back in the input", () => {
    const onChange = renderPicker();
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "amara" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: /Amara Obi/ }));

    expect(onChange).toHaveBeenCalledWith(many[0].enrolmentId);
  });

  it("shows the selected creator as the old option text did", () => {
    renderPicker(many[0].enrolmentId);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.value).toBe("1. Amara Obi (500 points)");
  });

  it("selects with the keyboard: arrow to a row, enter takes it", () => {
    const onChange = renderPicker();
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith(many[1].enrolmentId);
  });

  it("admits when nothing matches instead of showing an empty box", () => {
    renderPicker();
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzz" } });

    expect(screen.getByText(/No creator matches/)).toBeTruthy();
  });

  it("escape abandons the search and restores the standing choice", () => {
    renderPicker(many[0].enrolmentId, vi.fn());
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "cre" } });
    fireEvent.keyDown(input, { key: "Escape" });
    // Escape blurs; jsdom does not fire blur from blur(), so mirror it.
    fireEvent.blur(input);

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input.value).toBe("1. Amara Obi (500 points)");
  });

  it("pressing on the list itself does not close it", () => {
    renderPicker();
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    const list = screen.getByRole("listbox");
    // The scrollbar, the padding, and the keep-typing line all land here;
    // the default (focus steal, then blur, then close) must be suppressed.
    const event = fireEvent.mouseDown(list);
    expect(event).toBe(false);
  });

  it("a fresh search does not lose the standing choice until a new pick", () => {
    renderPicker(many[0].enrolmentId, vi.fn());
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "creator" } });
    fireEvent.blur(input);

    expect(input.value).toBe("1. Amara Obi (500 points)");
  });
});
