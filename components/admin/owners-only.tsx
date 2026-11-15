import { PageHeader } from "@/components/shared/panel";

/**
 * What a reviewer sees on an owner screen they reached by typing its address.
 *
 * The menu leaves these screens out for a reviewer, which is a tidy interface
 * and not a permission, so each page refuses again with this, and every route
 * behind it refuses a third time.
 */
export function OwnersOnly({ context, why }: { context: string; why: string }) {
  return <PageHeader context={context} title="Owners only" hint={`${why} Everything else in the console is open to you.`} />;
}
