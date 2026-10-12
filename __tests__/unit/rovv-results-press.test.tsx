/**
 * The results press, when the answer is not the route's own.
 *
 * Netlify ends a function at the plan's limit and answers with its own error
 * page, often after some of the results mail has gone. "That did not work"
 * there tells the owner nothing went, and is a reason to press on a wrong
 * belief; the counts on a reload are what is true.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { RovvResults } from "@/components/admin/rovv-queue";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const PARTLY = "It may have partly sent. Reload to see the counts before pressing again.";

function answer(status: number, body: () => Promise<unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: body })),
  );
}

async function pressYes() {
  render(<RovvResults toSend={120} sent={0} />);
  fireEvent.click(screen.getByRole("button", { name: "Email the results to 120 who did not win" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Yes, email 120" }));
}

beforeEach(() => {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the results press", () => {
  it("says it may have partly sent when the platform cut it off with its own page", async () => {
    answer(504, async () => {
      throw new SyntaxError("Unexpected token '<'");
    });
    await pressYes();
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith(PARTLY));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says the same for our own 500, which may also come after some mail left", async () => {
    answer(500, async () => ({ ok: false, message: "Something went wrong at our end." }));
    await pressYes();
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith(PARTLY));
  });

  it("says the same for a 200 that is not JSON", async () => {
    answer(200, async () => {
      throw new SyntaxError("Unexpected end of JSON input");
    });
    await pressYes();
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith(PARTLY));
  });

  it("passes on the route's own refusal as it was written", async () => {
    answer(409, async () => ({ ok: false, message: "Everybody has had the results email already." }));
    await pressYes();
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Everybody has had the results email already."),
    );
  });

  it("says how many are left when a press stopped for time", async () => {
    answer(200, async () => ({ ok: true, sent: 80, failed: 0, left: 40 }));
    await pressYes();
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Sent the results to 80. 40 still to go: press again."),
    );
  });
});
