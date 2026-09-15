/**
 * The audit page's table: filters compose, and the window stays honest.
 *
 * The trail existed from the first migration and was readable only with
 * SQL. Now that it is a page, what matters is that filtering never lies:
 * a filter change resets the reveal window so the newest matching rows
 * are what appears, and the count line says how many matched.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuditTable, actionLabel } from "@/components/admin/audit-table";

const row = (n: number, over: Partial<Parameters<typeof AuditTable>[0]["rows"][number]> = {}) => ({
  id: `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`,
  action: "points.awarded",
  entityType: "campaign_creator",
  adminEmail: "partnership@blockfestafrica.com",
  note: `note ${n}`,
  afterJson: null,
  dateLabel: `14 Sept, 12:${String(n).padStart(2, "0")}`,
  ...over,
});

describe("the audit table", () => {
  it("shows ten rows and reveals ten more on demand", () => {
    render(<AuditTable rows={Array.from({ length: 25 }, (_, i) => row(i))} />);

    expect(screen.getAllByText(/note \d+/)).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));
    expect(screen.getAllByText(/note \d+/)).toHaveLength(20);
  });

  it("filters by action, in human words, and resets the window", () => {
    const rows = [
      ...Array.from({ length: 12 }, (_, i) => row(i)),
      row(90, { action: "winner.published", note: "the announcement" }),
    ];
    render(<AuditTable rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: /show more/i }));

    fireEvent.change(screen.getByLabelText("Action"), {
      target: { value: "winner.published" },
    });

    expect(screen.getByText("the announcement")).toBeTruthy();
    expect(screen.queryByText("note 1")).toBeNull();
    expect(screen.getByText(/Showing all 1 matching/)).toBeTruthy();
  });

  it("filters by admin, with system rows selectable too", () => {
    const rows = [
      row(1),
      row(2, { adminEmail: null, action: "admin.identity_mismatch", note: "refused" }),
    ];
    render(<AuditTable rows={rows} />);

    fireEvent.change(screen.getByLabelText("Admin"), {
      target: { value: "system" },
    });
    expect(screen.getByText("refused")).toBeTruthy();
    expect(screen.queryByText("note 1")).toBeNull();
  });

  it("searches notes and the recorded change together", () => {
    const rows = [
      row(1, { note: "duplicate engagement bonus reversed" }),
      row(2, { afterJson: '{"platform": "tiktok"}', note: null }),
      row(3),
    ];
    render(<AuditTable rows={rows} />);

    fireEvent.change(screen.getByLabelText("Contains"), {
      target: { value: "tiktok" },
    });
    expect(screen.queryByText("duplicate engagement bonus reversed")).toBeNull();
    expect(screen.getByText(/Showing all 1 matching/)).toBeTruthy();
  });

  it("an empty result says so instead of rendering a bare box", () => {
    render(<AuditTable rows={[row(1)]} />);
    fireEvent.change(screen.getByLabelText("Contains"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it("labels known actions and passes unknown ones through honestly", () => {
    expect(actionLabel("submission.approved")).toBe("Entry approved");
    expect(actionLabel("some.future_action")).toBe("some.future_action");
  });
});
