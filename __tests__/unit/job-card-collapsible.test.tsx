import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JobCard, Pill } from "@/components/shared/panel";

/*
 * Owner ask: make the winners console's sections collapsible. The header row
 * (step, title, status) opens and closes its card with the browser's own
 * disclosure, a closed card still says where its job stands, and the state
 * is remembered per card in this browser.
 */

const card = (collapsible = true) => (
  <JobCard
    id="vote-round"
    step="Sunday"
    title="Community Favourite vote, week 1"
    status={<Pill tone="gold">Open</Pill>}
    hint="Verified votes only."
    foot={<button type="button">Close the vote</button>}
    collapsible={collapsible}
  >
    <p>Tally</p>
  </JobCard>
);

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/admin/winners");
});
afterEach(() => {
  window.localStorage.clear();
});

describe("a collapsible JobCard", () => {
  it("opens by default, with the title and status in the header that toggles it", () => {
    const { container } = render(card());
    const details = container.querySelector("details")!;
    expect(details.open).toBe(true);
    const summary = details.querySelector("summary")!;
    expect(summary.textContent).toContain("Community Favourite vote, week 1");
    expect(summary.textContent).toContain("Open");
    expect(screen.getByRole("heading", { name: "Community Favourite vote, week 1" })).toBeTruthy();
    // The job's content and its controls sit inside, so closing hides them.
    expect(details.textContent).toContain("Tally");
    expect(details.textContent).toContain("Close the vote");
  });

  it("stays closed if the owner left it closed", async () => {
    window.localStorage.setItem("job-card:vote-round", "closed");
    const { container } = render(card());
    await act(async () => {});
    expect(container.querySelector("details")!.open).toBe(false);
  });

  it("opens when the owner arrives by its link, whatever was remembered", async () => {
    window.localStorage.setItem("job-card:vote-round", "closed");
    window.history.replaceState(null, "", "/admin/winners#vote-round");
    const { container } = render(card());
    await act(async () => {});
    expect(container.querySelector("details")!.open).toBe(true);
  });

  it("remembers a toggle", async () => {
    const { container } = render(card());
    await act(async () => {});
    const details = container.querySelector("details")!;
    await act(async () => {
      details.open = false;
      details.dispatchEvent(new Event("toggle"));
    });
    expect(window.localStorage.getItem("job-card:vote-round")).toBe("closed");
  });

  it("is a plain card when not asked to collapse", () => {
    const { container } = render(card(false));
    expect(container.querySelector("details")).toBeNull();
    expect(screen.getByRole("heading", { name: "Community Favourite vote, week 1" })).toBeTruthy();
  });
});

describe("the winners console", () => {
  it("makes every card on the page collapsible", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const file of [
      "components/admin/winners-panel.tsx",
      "components/admin/vote-round-panel.tsx",
      "components/admin/blocked-domains-card.tsx",
    ]) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      const cards = src.match(/<JobCard\b/g) ?? [];
      const collapsible = src.match(/<JobCard\s+collapsible\b/g) ?? [];
      expect(collapsible.length, file).toBe(cards.length);
    }
  });
});
