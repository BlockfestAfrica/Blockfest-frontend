"use client";

import { useRef } from "react";
import { Confirm } from "@/components/shared/confirm";

/**
 * Sign out on this device, asked once.
 *
 * Coming back needs the personal link from the registration email, opened in
 * this same browser. For the owner of the phone, who is the one person likely
 * to press this by mistake, that email may be long gone, and this page already
 * warns that in-app browsers keep their own cookies. So the question says what
 * getting back in takes before it happens.
 *
 * The trigger stays a submit button, so before the page has hydrated a press
 * still signs out rather than doing nothing. After hydration the press opens
 * the question, and only "Yes" submits the form to the server action.
 */
export function SignOutForm({ action }: { action: () => Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="mt-6">
      <Confirm
        label="Sign out on this device"
        question="Sign out on this device?"
        consequence="To get back in you need the link from your registration email, opened in this browser. If you no longer have it, the Lost your link page mails a new one."
        confirmLabel="Yes, sign me out"
        triggerType="submit"
        triggerClassName="inline-flex min-h-11 cursor-pointer items-center text-sm text-ink-3 underline underline-offset-4 transition-colors hover:text-white"
        onConfirm={() => formRef.current?.requestSubmit()}
      />
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-4">
        The link in your email signs you back in. Use this if you are on
        somebody else&apos;s phone.
      </p>
    </form>
  );
}
