import type { Metadata } from "next";

import { DisputeCase } from "./DisputeCase";

export const metadata: Metadata = { title: "Dispute · Safka" };

export default function DisputePage() {
	return <DisputeCase />;
}
