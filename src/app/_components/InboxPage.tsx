"use client";

import type { DealListFilter } from "@/shared/contracts";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useMe } from "../(app)/AppShell";
import { DealList } from "./DealList";
import { ButtonLink, EmptyState, PageHeader } from "./ui";

const FILTERS: readonly DealListFilter[] = ["needs_action", "in_progress", "closed"];

/** `/brand/deals` and `/creator/inbox`: same list, filter kept in the URL. */
export function InboxPage() {
	const me = useMe();
	const router = useRouter();
	const pathname = usePathname();
	const raw = useSearchParams().get("filter");
	const filter: DealListFilter = FILTERS.includes(raw as DealListFilter) ? (raw as DealListFilter) : "needs_action";
	const isCreator = me.role === "CREATOR";

	return (
		<>
			<PageHeader
				eyebrow={isCreator ? "Inbox" : "Sponsorships"}
				title={isCreator ? "Your offers and deals" : "Deals"}
				description={isCreator ? "Offers, drafts and delivery in one place. Everything waiting on you is first." : "Every offer and sponsorship, with who acts next."}
				actions={isCreator ? undefined : <ButtonLink href="/brand/creators" variant="secondary">Find creators</ButtonLink>}
			/>
			<DealList
				viewer={me.role}
				filter={filter}
				onFilterChange={(f) => router.replace(`${pathname}?filter=${f}`, { scroll: false })}
				empty={
					isCreator && !me.profileReady && filter === "needs_action" ? (
						<EmptyState
							title="No offers yet"
							description="Brands can only find you once your profile is listed."
							action={<ButtonLink href="/creator/onboarding">Finish profile</ButtonLink>}
						/>
					) : undefined
				}
			/>
		</>
	);
}
