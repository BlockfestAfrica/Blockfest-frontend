import { redirect } from "next/navigation";

/**
 * Tools was four unrelated jobs on one page, each now its own screen in the
 * menu: Approved links, New personal link, Points and Pack resources
 * (lib/admin/console-nav.ts). The address is kept for bookmarks and lands on
 * the one every admin can use.
 */
export default function ToolsPage() {
  redirect("/admin/link-check");
}
