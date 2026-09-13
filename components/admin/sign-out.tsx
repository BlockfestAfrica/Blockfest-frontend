"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { buttonClass } from "@/components/shared/panel";

/**
 * Sign out, from both halves of where the session lives.
 *
 * Netlify Identity keeps the JWT in a cookie the server can clear and a refresh
 * token in localStorage it cannot, so clearing only one leaves the other able
 * to mint a replacement. This clears the browser half and asks the route to
 * clear the cookies, then sends the admin to the login page.
 *
 * No confirmation step. Signing out is the reversible action, and putting a
 * question in front of it is how somebody on a borrowed laptop gives up and
 * closes the tab instead.
 */
export function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      /*
       * Cleared before the request, not after. If the network call fails, the
       * browser half is already gone, which is the half an attacker with this
       * machine would use.
       */
      try {
        for (const key of Object.keys(window.localStorage)) {
          if (key.startsWith("gotrue.") || key.startsWith("netlify")) {
            window.localStorage.removeItem(key);
          }
        }
      } catch {
        // A browser with storage blocked has nothing to clear.
      }

      const response = await fetch("/api/admin/signout", { method: "POST" });
      if (!response.ok) {
        toast.error("We could not sign you out. Close the browser to be sure.");
        return;
      }

      router.replace("/admin/login");
      router.refresh();
    } catch {
      toast.error("We could not reach the server. Close the browser to be sure.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className={buttonClass("quiet")}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
