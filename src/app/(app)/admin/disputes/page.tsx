import type { Metadata } from "next";

import { DisputeQueue } from "./DisputeQueue";

export const metadata: Metadata = { title: "Disputes · Safka" };

export default function DisputesPage() {
	return <DisputeQueue />;
}
