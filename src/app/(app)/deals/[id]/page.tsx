import type { Metadata } from "next";

import { DealWorkspace } from "./DealWorkspace";

export const metadata: Metadata = { title: "Deal · Safka" };

export default function DealPage() {
	return <DealWorkspace />;
}
