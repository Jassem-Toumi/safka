"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { getDeal } from "@/lib/api";
import { homePathFor } from "@/lib/routing";
import { errorMessage, isNotFound, useLoad } from "@/lib/useLoad";

import { DealRoom } from "../../../_components/deal/DealRoom";
import { Alert, Loading } from "../../../_components/ui";
import { NotAvailable, useMe } from "../../AppShell";

export default function DealPage() {
	const { id } = useParams<{ id: string }>();
	const me = useMe();
	const deal = useLoad(() => getDeal(id), id, { refreshOnFocus: true });
	const back = me.role === "CREATOR" ? "/creator/inbox" : me.role === "BRAND" ? "/brand/deals" : "/admin/disputes";

	if (deal.status === "loading") return <Loading />;
	if (deal.status === "failed" && isNotFound(deal.error)) return <NotAvailable home={homePathFor(me)} />;
	if (deal.data === null) return <Alert>{errorMessage(deal.error)}</Alert>;

	return (
		<>
			<Link href={back} className="mb-6 inline-block text-sm text-muted hover:text-ink">
				← {me.role === "CREATOR" ? "Inbox" : me.role === "BRAND" ? "Deals" : "Disputes"}
			</Link>
			<DealRoom deal={deal.data} viewer={me.role} onDeal={deal.setData} reload={deal.reload} />
		</>
	);
}
