/**
 * Row actions open where the admin is looking.
 *
 * Pressing Disqualify, fix or Points on the People table used to render a
 * form once, after the whole list. On a long list it appeared far below the
 * button with nothing to say it had appeared, so the action looked like it did
 * nothing and the reason field it was waiting for went unseen. These pin the
 * dialog that replaced it: that it opens in front of the admin on the field to
 * fill in, that it closes the usual ways, and that it cannot be dismissed while
 * the request is in flight.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ActionDialog } from "@/components/shared/action-dialog";

function Harness({
  open = true,
  busy = false,
  onOpenChange = () => {},
}: {
  open?: boolean;
  busy?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Disqualify Ada Obi"
      tone="danger"
      busy={busy}
    >
      <label htmlFor="why">Why</label>
      <input id="why" data-autofocus />
      <button type="button">Disqualify Ada Obi</button>
    </ActionDialog>
  );
}

/** A real opener, the way the People table opens its dialogs: from state. */
function WithOpener({ onOpenChange = () => {} }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Disqualify row 40
      </button>
      <ActionDialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          setOpen(next);
        }}
        title="Disqualify Ada Obi"
      >
        <label htmlFor="why">Why</label>
        <input id="why" data-autofocus />
      </ActionDialog>
    </>
  );
}

describe("the action dialog", () => {
  it("is a named modal dialog, not a panel somewhere down the page", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog", { name: "Disqualify Ada Obi" });
    expect(dialog).toBeTruthy();
  });

  it("opens on the field to fill in, not on the close button", () => {
    render(<Harness />);
    expect(document.activeElement).toBe(screen.getByLabelText("Why"));
  });

  it("closes on Escape", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.keyDown(screen.getByLabelText("Why"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes from its close button", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cannot be dismissed while the request is in flight", () => {
    // Closing mid-request would leave the admin unsure whether a
    // disqualification went through.
    const onOpenChange = vi.fn();
    render(<Harness busy onOpenChange={onOpenChange} />);
    fireEvent.keyDown(screen.getByLabelText("Why"), { key: "Escape" });
    const close = screen.getByRole("button", { name: "Close" });
    expect((close as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(close);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("gives focus back to the button that opened it, not the top of the page", async () => {
    render(<WithOpener />);
    const opener = screen.getByRole("button", { name: "Disqualify row 40" });
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByLabelText("Why"));

    fireEvent.keyDown(screen.getByLabelText("Why"), { key: "Escape" });
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("stays open when the backdrop is tapped, which on a phone is how the keyboard is put away", async () => {
    const onOpenChange = vi.fn();
    render(<WithOpener onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Disqualify row 40" }));
    onOpenChange.mockClear();
    // Radix starts listening for outside presses a tick after opening; a
    // tap fired before then would pass whatever the dialog did.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    const overlay = document.querySelector(
      '[data-state="open"]:not([role="dialog"])',
    ) as HTMLElement;
    expect(overlay, "found the backdrop").toBeTruthy();
    fireEvent.pointerDown(overlay, { pointerType: "touch", button: 0 });
    fireEvent.pointerUp(overlay, { pointerType: "touch", button: 0 });
    fireEvent.click(overlay);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("renders nothing while closed", () => {
    render(<Harness open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

/*
 * Comments are stripped first: prose explaining a rule has been read as the
 * rule by tests like this before.
 */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

describe("the People table's row actions", () => {
  const src = codeOnly(
    readFileSync(join(process.cwd(), "components/admin/participants-table.tsx"), "utf8"),
  );

  it("open dialogs for all three, once, outside the responsive split", () => {
    expect((src.match(/<ActionDialog\b/g) ?? []).length).toBe(3);
    expect(src).toMatch(/open=\{voidingRow !== null\}/);
    expect(src).toMatch(/open=\{fixing !== null\}/);
    expect(src).toMatch(/open=\{selected !== null\}/);
  });

  it("say so to assistive technology, instead of pointing at a panel that is not there", () => {
    expect(src).not.toContain('aria-controls="award-panel"');
    // Points, Disqualify and fix, in the card list and in the table.
    expect((src.match(/aria-haspopup="dialog"/g) ?? []).length).toBe(6);
  });

  it("open each form on the field it is waiting for", () => {
    expect(src).toMatch(/id=\{`void-why-\$\{voidingRow\.enrolmentId\}`\}\s*data-autofocus/);
    expect(src).toMatch(/id=\{`fix-\$\{enrolmentId\}-\$\{platform\}`\}\s*data-autofocus/);
    expect(src).toMatch(/id="award-source"\s*data-autofocus/);
  });

  it("no longer needs to chase the form down the page", () => {
    expect(src).not.toContain("scrollIntoView");
    expect(src).not.toContain('id="award-panel"');
  });

  it("puts the engagement entry above Apply, since Apply waits for it", () => {
    const entry = src.indexOf('id="award-entry"');
    const apply = src.indexOf('"Apply"');
    expect(entry).toBeGreaterThan(-1);
    expect(entry).toBeLessThan(apply);
  });
});

describe("the other places an action opened out of sight", () => {
  const read = (file: string) =>
    codeOnly(readFileSync(join(process.cwd(), file), "utf8"));

  it("edits a resource in a dialog, opened on the title", () => {
    const src = read("components/admin/resources-editor.tsx");
    expect(src).toMatch(/<ActionDialog\b[\s\S]*open=\{open\}/);
    expect(src).toMatch(/id="res-title"\s*data-autofocus/);
    // Edit and Add both open it; neither leaves a form at the foot of the list.
    expect(src).not.toMatch(/\{open \? \(/);
  });

  it("asks about unsaved challenge text in a dialog, defaulting to keep editing", () => {
    const src = read("components/admin/challenge-editor.tsx");
    expect(src).toMatch(/<ActionDialog\b[\s\S]*open=\{discarding !== null\}/);
    expect(src).toMatch(/data-autofocus[\s\S]{0,300}Keep editing/);
    expect(src).not.toMatch(/open === challenge\.id && discarding && \(/);
  });

  it("brings an opened challenge editor into view with the cursor in its title", () => {
    const src = read("components/admin/challenge-editor.tsx");
    expect(src).toMatch(/reveal\(\s*document\.getElementById\(`week-\$\{open\}`\)/);
    expect(src).toContain("id={`week-${challenge.id}`}");
  });

  it("confirms a vote removal in one dialog, whichever list the button is in", () => {
    const src = read("components/admin/vote-round-panel.tsx");
    expect((src.match(/<ActionDialog\b/g) ?? []).length).toBe(1);
    expect(src).toMatch(/open=\{removing !== null\}/);
    expect(src).not.toMatch(/removing === (m|h)\.voteId &&/);
    expect(src).toMatch(/id=\{`remove-reason-\$\{voteId\}`\}\s*data-autofocus/);
  });

  it("scrolls an expanded review row, rule editor and handle form into view", () => {
    expect(read("components/admin/review-queue.tsx")).toMatch(/reveal\(document\.getElementById\(`review-\$\{open\}`\)\)/);
    expect(read("components/admin/point-rules-editor.tsx")).toMatch(/reveal\(fields,/);
    expect(read("components/campaigns/handle-fix.tsx")).toMatch(/reveal\(\s*document\.getElementById\(`handle-fix-\$\{open\}`\)/);
  });
});

describe("reveal", () => {
  it("scrolls the target into view and focuses the field without a second jump", async () => {
    const { reveal } = await import("@/components/shared/reveal");
    const target = document.createElement("div");
    const field = document.createElement("input");
    target.appendChild(field);
    document.body.appendChild(target);
    const scroll = vi.fn();
    target.scrollIntoView = scroll;
    const focus = vi.spyOn(field, "focus");

    reveal(target, field);

    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: "nearest" }));
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    target.remove();
  });

  it("does nothing, rather than throwing, when the target is gone", async () => {
    const { reveal } = await import("@/components/shared/reveal");
    expect(() => reveal(null)).not.toThrow();
  });
});

describe("the dialog's surface", () => {
  const dialog = codeOnly(
    readFileSync(join(process.cwd(), "components/shared/action-dialog.tsx"), "utf8"),
  );

  it("is opaque, because bg-card is a 2% tint meant for cards on the page ground", () => {
    // The Content element's own class list, not the close button inside it,
    // whose hover:bg-card-2 is a hover wash over an already opaque panel.
    const classes = (dialog.match(/className=\{`(fixed inset-x-0[^`]*)`/) ?? [])[1] ?? "";
    const tokens = classes.split(/\s+/);
    expect(tokens, "found the panel's classes").toContain("bg-ground");
    expect(tokens).not.toContain("bg-card");
  });

  it("wraps a long title, such as a voter's email, instead of running under the close button", () => {
    expect(dialog).toMatch(/<Dialog\.Title className="[^"]*\[overflow-wrap:anywhere\]/);
  });
});

describe("a resource draft", () => {
  const src = codeOnly(
    readFileSync(join(process.cwd(), "components/admin/resources-editor.tsx"), "utf8"),
  );

  it("survives a dismissed dialog, and only a save or an agreed discard clears it", () => {
    const onOpenChange = src.slice(src.indexOf("onOpenChange="), src.indexOf("title="));
    expect(onOpenChange).not.toContain("setForm(EMPTY)");
    // Add resumes a new draft, and leaving an edit for a fresh add asks.
    expect(src).toMatch(/form\.id \? requestLeave\("new"\) : setOpen\(true\)/);
    // Cancel asks when there is anything to lose.
    expect(src).toMatch(/onClick=\{\(\) => requestLeave\("close"\)\}/);
  });
});
