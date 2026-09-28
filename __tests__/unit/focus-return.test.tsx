/*
 * A request that settles never takes focus from where the creator went.
 *
 * The forms stay editable while a request runs. A refusal used to hand
 * focus back to the submit button even when the creator had gone back into
 * the field to fix it, so whatever they typed next was lost and a Space sent
 * the request again. These pin that a field keeps focus, and that a refusal
 * about the link does not pull focus into it from elsewhere on the page.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WeekRows } from "@/components/campaigns/week-rows";
import { AccountRows } from "@/components/campaigns/account-rows";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/sabilytics", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/sabilytics")>()),
  track: vi.fn(),
}));
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function held() {
  let answer!: (ok: boolean) => void;
  fetchMock.mockImplementationOnce(() => new Promise((r) => { answer = (ok) => r({ ok, json: async () => ({ ok, message: "No." }) }); }));
  return (ok: boolean) => answer(ok);
}

it("week row: a refusal leaves the creator in the link field they went back to", async () => {
  const answer = held();
  render(<WeekRows rows={[{ platform: "tiktok", handle: "adaobi", entry: null, canSubmit: true }]} weekNo={2} challengeTitle="T" statusKnown canResend />);
  fireEvent.click(screen.getByRole("button", { name: "Submit your TikTok post" }));
  const field = screen.getByLabelText("Public link to your post");
  fireEvent.change(field, { target: { value: "https://www.tiktok.com/@adaobi/video/1" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Submit this entry" })); });
  field.focus(); // back in the field, editing, while it runs
  await act(async () => { answer(false); });
  expect(document.activeElement).toBe(field);
});

it("account row: a refused correction leaves the creator in the reason field", async () => {
  const answer = held();
  render(<AccountRows handles={[{ platform: "x", handle: "adaobi_writes" }]} requests={[]} missing={[]} />);
  fireEvent.click(screen.getByRole("button", { name: /Wrong username\? Ask for a correction to your X/ }));
  fireEvent.change(screen.getByLabelText("The correct username"), { target: { value: "adaobi2" } });
  const why = screen.getByLabelText("What went wrong");
  fireEvent.change(why, { target: { value: "Typo" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send the request" })); });
  why.focus();
  await act(async () => { answer(false); });
  expect(document.activeElement).toBe(why);
});

it("add row: a refused add leaves the creator in the username field", async () => {
  const answer = held();
  render(<AccountRows handles={[]} requests={[]} missing={["tiktok"]} />);
  fireEvent.click(screen.getByRole("button", { name: "Add TikTok" }));
  const field = screen.getByLabelText("Your TikTok username");
  fireEvent.change(field, { target: { value: "adaobi" } });
  fireEvent.click(screen.getByRole("button", { name: "Add TikTok" }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Yes, add it" })); });
  field.focus();
  await act(async () => { answer(false); });
  expect(document.activeElement).toBe(field);
});

it("week row: a refusal about the link does not pull focus from elsewhere on the page", async () => {
  let answer!: () => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((r) => {
        answer = () =>
          r({ ok: false, json: async () => ({ ok: false, field: "url", message: "That link is not public." }) });
      }),
  );
  const outside = document.createElement("button");
  outside.textContent = "Copy your referral link";
  document.body.appendChild(outside);
  render(<WeekRows rows={[{ platform: "tiktok", handle: "adaobi", entry: null, canSubmit: true }]} weekNo={2} challengeTitle="T" statusKnown canResend />);
  fireEvent.click(screen.getByRole("button", { name: "Submit your TikTok post" }));
  fireEvent.change(screen.getByLabelText("Public link to your post"), {
    target: { value: "https://www.tiktok.com/@adaobi/video/1" },
  });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Submit this entry" })); });
  outside.focus();
  await act(async () => { answer(); });
  expect(document.activeElement).toBe(outside);
  outside.remove();
});
