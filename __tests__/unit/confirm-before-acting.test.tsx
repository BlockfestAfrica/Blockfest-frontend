/**
 * Asked once, before the actions that cannot be taken back.
 *
 * A sweep of every admin and creator screen found eleven presses that emailed
 * somebody, moved points, signed someone out or threw away typed work on the
 * first tap, several of them beside a harmless button of the same size. These
 * render the real components and walk each press: the question appears with
 * the thing being acted on said back, nothing is sent until "Yes", and the
 * everyday case that should stay one press still is one press.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Confirm } from "@/components/shared/confirm";
import { ReviewQueue, type QueueItem } from "@/components/admin/review-queue";
import { ReissueLink } from "@/components/admin/reissue-link";
import { PauseSwitch } from "@/components/admin/pause-switch";
import { RepriceEntry } from "@/components/admin/reprice-entry";
import { HandleRequestQueue } from "@/components/admin/handle-request-queue";
import { PointRulesEditor } from "@/components/admin/point-rules-editor";
import { ResourcesEditor } from "@/components/admin/resources-editor";
import { AddPlatform } from "@/components/campaigns/add-platform";
import { SignOutForm } from "@/components/campaigns/sign-out-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ ok: true, name: "Ada Obi", link: "https://example.test/x", emailed: true }),
}));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** The JSON body of the nth fetch call. */
function sent(n = 0) {
  const init = (fetchMock.mock.calls[n] as unknown[] | undefined)?.[1] as RequestInit | undefined;
  return init?.body ? JSON.parse(String(init.body)) : undefined;
}

const question = () => screen.queryByRole("alertdialog");

describe("Confirm", () => {
  it("asks, focuses Cancel, and acts only on Yes", () => {
    const onConfirm = vi.fn();
    render(
      <Confirm label="Go" question="Really go?" consequence="It goes." confirmLabel="Yes, go" onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(question()).not.toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, go" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(question()).toBeNull();
  });

  it("acts on the first press when there is nothing to ask", () => {
    const onConfirm = vi.fn();
    render(
      <Confirm
        label="Go"
        when={false}
        question="Really go?"
        consequence="It goes."
        confirmLabel="Yes, go"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(question()).toBeNull();
  });

  it("puts focus back on its button after Escape or Cancel", () => {
    render(<Confirm label="Go" question="Really go?" consequence="It goes." confirmLabel="Yes, go" onConfirm={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    fireEvent.keyDown(question()!, { key: "Escape" });
    expect(question()).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Go" }));
  });

  it("as a submit button, opens the question instead of submitting the form", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Confirm
          label="Send"
          triggerType="submit"
          question="Send it?"
          consequence="It is sent."
          confirmLabel="Yes, send"
          onConfirm={() => {}}
        />
      </form>,
    );
    const trigger = screen.getByRole("button", { name: "Send" });
    expect(trigger.getAttribute("type")).toBe("submit");
    fireEvent.click(trigger);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(question()).not.toBeNull();
  });

  it("keeps a caller's own look and busy label on the trigger", () => {
    render(
      <Confirm
        label="Approve"
        question="?"
        consequence="."
        confirmLabel="Yes"
        pending
        triggerClassName="green-button"
        triggerContent="Approving…"
        onConfirm={() => {}}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Approving…" });
    expect(trigger.className).toBe("green-button");
    expect(trigger).toHaveProperty("disabled", true);
  });
});

// Asserted rather than annotated, so the row still type-checks whichever way
// the queue's lane field goes.
const ITEM = {
  id: "s1",
  url: "https://www.instagram.com/p/abc/",
  weekNo: 2,
  challengeTitle: "The Proof",
  platformLabel: "Instagram",
  submittedAt: "2026-09-20T10:00:00Z",
  creatorName: "Ada Obi",
  registeredHandle: "adaobi",
  contested: false,
} as QueueItem;

function openRow() {
  fireEvent.click(screen.getByRole("button", { name: /Ada Obi/ }));
}

describe("review queue Approve", () => {
  it("stays one press on an ordinary row with no note", async () => {
    render(<ReviewQueue items={[ITEM]} />);
    openRow();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    });
    expect(question()).toBeNull();
    expect(sent()).toMatchObject({ submissionId: "s1", decision: "approved" });
  });

  it("asks when a note is typed, and quotes the note the creator will see", async () => {
    render(<ReviewQueue items={[ITEM]} />);
    openRow();
    fireEvent.change(screen.getByPlaceholderText(/Reason, required to reject/), {
      target: { value: "Not your account" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(question()?.textContent).toContain("with your note");
    expect(question()?.textContent).toContain("“Not your account”");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, approve" }));
    });
    expect(sent()).toMatchObject({ decision: "approved", note: "Not your account" });
  });

  it("says an approval will be refused when the other claim is already paid", () => {
    render(<ReviewQueue items={[{ ...ITEM, contested: true, creditedElsewhere: true }]} />);
    openRow();
    // A typed note too: the refusal happens before the note would be saved.
    fireEvent.change(screen.getByPlaceholderText(/Reason, required to reject/), {
      target: { value: "Wrong account" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const text = question()?.textContent ?? "";
    expect(text).toContain("already approved");
    expect(text).toContain("this approval will be refused");
    expect(text).toContain("nothing is saved or sent to the creator");
    expect(text).not.toContain("Approving credits it");
    expect(text).not.toContain("shows on their page");
    expect(text).not.toContain("cannot be put back");
  });

  it("asks on a contested post", () => {
    render(<ReviewQueue items={[{ ...ITEM, contested: true }]} />);
    openRow();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(question()?.textContent).toContain("Approve Ada Obi for this contested post?");
  });
});

describe("reissue a creator link", () => {
  it("says the address back and only posts on Yes, enter included", async () => {
    const { container } = render(<ReissueLink />);
    fireEvent.change(screen.getByPlaceholderText("The email they registered with"), {
      target: { value: "ada@example.test" },
    });
    // Enter in the field submits the form; the form must only ask.
    fireEvent.submit(container.querySelector("form")!);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(question()?.textContent).toContain("Issue a new link for ada@example.test?");
    // Enter again while the question is open still does not post.
    fireEvent.submit(container.querySelector("form")!);
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, issue a new link" }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent()).toEqual({ email: "ada@example.test" });
  });
});

describe("start the campaign again", () => {
  it("names the email to every creator before it resumes", async () => {
    render(<PauseSwitch paused />);
    fireEvent.click(screen.getByRole("button", { name: /Start the campaign again/ }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(question()?.textContent).toContain("email every active creator");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, start it and tell them" }));
    });
    expect(sent()).toMatchObject({ paused: false });
  });
});

describe("reprice one entry", () => {
  it("does not ask about a malformed id; asks about a real one", () => {
    render(<RepriceEntry />);
    fireEvent.change(screen.getByLabelText("Entry id"), { target: { value: "not-an-id" } });
    fireEvent.change(screen.getByLabelText("Why"), { target: { value: "Rates" } });
    fireEvent.click(screen.getByRole("button", { name: "Reprice this entry" }));
    expect(question()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Entry id"), {
      target: { value: "3f2504e0-4f89-11d3-9a0c-0305e82c3301" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reprice this entry" }));
    expect(question()?.textContent).toContain("Reprice entry 3f2504e0…3301");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("approve a handle correction", () => {
  it("restates old and new before changing it", async () => {
    render(
      <HandleRequestQueue
        requests={[
          {
            id: "r1",
            creatorName: "Ada Obi",
            creatorEmail: "ada@example.test",
            platform: "TikTok",
            oldHandle: "ada_obi",
            requestedHandle: "adaobi",
            takenBy: null,
            reason: "Typo",
            createdAt: "2026-09-20T10:00:00Z",
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Approve the change" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(question()?.textContent).toContain("from @ada_obi to @adaobi");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, change it" }));
    });
    expect(sent()).toMatchObject({ requestId: "r1", approve: true, expectedHandle: "adaobi" });
  });
});

describe("point rules", () => {
  const RULE = { id: "p1", key: "referral", defaultPoints: 10, minPoints: null, maxPoints: null };

  it("saves at once when no number moved", async () => {
    render(<PointRulesEditor rules={[RULE]} weekBase={100} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(question()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not claim to clear a bound the server keeps", async () => {
    // update_point_rule keeps the current value for a blank field.
    render(
      <PointRulesEditor
        rules={[{ id: "p2", key: "manual_adjustment", defaultPoints: 10, minPoints: -50, maxPoints: 50 }]}
        weekBase={100}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/^Ceiling/), { target: { value: "" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(question()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks about a floor-only change, with the recovery that rule actually has", () => {
    render(
      <PointRulesEditor
        rules={[{ id: "p2", key: "manual_adjustment", defaultPoints: 10, minPoints: -50, maxPoints: 50 }]}
        weekBase={100}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/^Floor/), { target: { value: "-40" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(question()?.textContent).toContain("floor -50 to -40");
    expect(question()?.textContent).toContain("Nothing already awarded changes");
    expect(question()?.textContent).not.toContain("repriced");
  });

  it("does not ask about the legacy entry base, which nothing reads", async () => {
    render(
      <PointRulesEditor
        rules={[{ id: "p3", key: "entry_base", defaultPoints: 100, minPoints: null, maxPoints: null }]}
        weekBase={100}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Points"), { target: { value: "150" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    expect(question()).toBeNull();
  });

  it("says old and new back, and that the public pages state this one", () => {
    render(<PointRulesEditor rules={[RULE]} weekBase={100} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Points"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(question()?.textContent).toContain("Change Referral: points 10 to 100?");
    expect(question()?.textContent).toContain("public campaign pages state this figure");
  });
});

describe("pack resources", () => {
  it("asks before Cancel throws away typed text, and keeps it on Keep editing", () => {
    render(<ResourcesEditor rows={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a resource" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Brand kit" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(question()?.textContent).toContain("Discard what you have written?");
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(question()).toBeNull();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Brand kit");
  });

  it("Escape on the question goes back to the form, not out of the dialog", () => {
    render(<ResourcesEditor rows={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a resource" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Brand kit" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Keep editing" }), { key: "Escape" });
    expect(question()).toBeNull();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Brand kit");
  });

  it("asks before Edit on another row replaces an unsaved draft, then loads that row", () => {
    const row = (id: string, title: string) => ({
      id,
      section: "pack",
      title,
      body: null,
      url: "https://example.test/" + id,
      displayOrder: 0,
      isPublished: true,
    });
    render(<ResourcesEditor rows={[row("a", "Brand kit"), row("b", "Caption guide")]} />);
    const edits = screen.getAllByRole("button", { name: /^Edit/ });
    fireEvent.click(edits[0]);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Brand kit v2" } });
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });
    expect(screen.queryByLabelText("Title")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: /^Edit/ })[1]);
    expect(question()?.textContent).toContain("Discard what you have written?");
    fireEvent.click(screen.getByRole("button", { name: "Discard it" }));
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Caption guide");
  });

  it("closes straight away when nothing was typed", () => {
    render(<ResourcesEditor rows={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a resource" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(question()).toBeNull();
    expect(screen.queryByLabelText("Title")).toBeNull();
  });
});

describe("a creator adding a platform", () => {
  it("shows the username as it will be stored, a pasted link reduced to the name", () => {
    render(<AddPlatform missing={["x"]} platformLabels={{ x: "X" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Add X" }));
    fireEvent.change(screen.getByLabelText("Your X username"), {
      target: { value: "https://x.com/AdaObi/status/123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add X" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(question()?.textContent).toContain("Add @adaobi as your X account?");
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(question()).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText("Your X username"));
  });

  it("adds exactly that account on Yes, with room for a whole pasted link", async () => {
    render(<AddPlatform missing={["tiktok"]} platformLabels={{ tiktok: "TikTok" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Add TikTok" }));
    const field = screen.getByLabelText("Your TikTok username") as HTMLInputElement;
    const paste = "https://www.tiktok.com/@adaeze.creates.daily?_t=ZM-8abc&_r=1";
    expect(field.maxLength).toBeGreaterThanOrEqual(paste.length);
    fireEvent.change(field, { target: { value: paste } });
    fireEvent.click(screen.getByRole("button", { name: "Add TikTok" }));
    expect(question()?.textContent).toContain("Add @adaeze.creates.daily as your TikTok account?");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, add it" }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent()).toMatchObject({ platform: "tiktok" });
  });
});

describe("a creator signing out", () => {
  it("says how to get back in, and signs out only on Yes", async () => {
    const action = vi.fn(async () => {});
    render(<SignOutForm action={action} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out on this device" }));
    expect(action).not.toHaveBeenCalled();
    expect(question()?.textContent).toContain("registration email");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, sign me out" }));
    });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("still signs out on a browser without requestSubmit (iOS 15 and older)", async () => {
    const original = HTMLFormElement.prototype.requestSubmit;
    // @ts-expect-error removed to stand in for WebKit before 16
    delete HTMLFormElement.prototype.requestSubmit;
    try {
      const action = vi.fn(async () => {});
      render(<SignOutForm action={action} />);
      fireEvent.click(screen.getByRole("button", { name: "Sign out on this device" }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Yes, sign me out" }));
      });
      expect(action).toHaveBeenCalledTimes(1);
    } finally {
      HTMLFormElement.prototype.requestSubmit = original;
    }
  });
});

/*
 * The three that need a campaign's worth of props to mount are pinned by
 * source, comments stripped, so a sentence about the old behaviour cannot
 * satisfy an assertion about the new one.
 */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
const read = (file: string) => codeOnly(readFileSync(join(process.cwd(), file), "utf8"));

describe("the screens pinned by source", () => {
  it("opening the vote goes through Confirm, restating names and window", () => {
    const src = read("components/admin/vote-round-panel.tsx");
    expect(src).not.toMatch(/onClick=\{openRound\}/);
    expect(src).toMatch(/<Confirm\s+key="open-vote"\s+label="Open the vote"[\s\S]*?onConfirm=\{openRound\}/);
    expect(src).toMatch(/longDay\(voteDay\)\} \$\{opensTime\} to \$\{closesTime\} Lagos time/);
  });

  it("keys every step's Confirm, so an open question never carries into the next step", () => {
    const src = read("components/admin/vote-round-panel.tsx");
    for (const key of ["open-vote", "review-vote", "tell-vote", "close-vote"]) {
      expect(src).toContain(`key="${key}"`);
    }
  });

  it("saving a week asks only when status or base points change", () => {
    const src = read("components/admin/challenge-editor.tsx");
    expect(src).toMatch(/when=\{riskyChange\(challenge\) !== null\}/);
    expect(src).toMatch(/form\.status !== baseline\.status/);
    expect(src).toMatch(/form\.basePoints !== baseline\.basePoints/);
    // A week made live before its window says when it will appear.
    expect(src).toMatch(/new Date\(challenge\.startsAt\)\.getTime\(\) > Date\.now\(\)/);
  });

  it("the submission hint names the account for the platform the form will send", () => {
    const src = read("components/campaigns/submission-form.tsx");
    expect(src).toMatch(/handles\?\.\[selected\]/);
    expect(src).not.toMatch(/handles\?\.\[platform\]/);
  });

  it("the /me page signs out through the asking form", () => {
    const src = read("app/campaigns/monica-money-story/me/page.tsx");
    expect(src).toMatch(/<SignOutForm action=\{signOut\} \/>/);
    expect(src).not.toMatch(/<form action=\{signOut\}/);
  });

  it("the resume mail's comment no longer claims a filter the query lacks", () => {
    const src = readFileSync(join(process.cwd(), "app/api/admin/pause/route.ts"), "utf8");
    expect(src).not.toMatch(/have not\s+\*?\s*already submitted on every platform/);
  });
});
