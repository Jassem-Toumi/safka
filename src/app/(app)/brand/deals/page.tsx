import type { Metadata } from "next";

import { DealList } from "@/app/(app)/deals/_parts/DealList";

export const metadata: Metadata = { title: "Deals · Safka" };

export default function BrandDealsPage() {
	return <DealList heading="Deals" />;
}
