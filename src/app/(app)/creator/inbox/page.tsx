import type { Metadata } from "next";

import { DealList } from "@/app/(app)/deals/_parts/DealList";

export const metadata: Metadata = { title: "Inbox · Safka" };

export default function CreatorInboxPage() {
	return <DealList heading="Inbox" />;
}
