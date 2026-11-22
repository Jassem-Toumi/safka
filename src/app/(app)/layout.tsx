import type { ReactNode } from "react";

import { Suspense } from "react";

import { Loading } from "../_components/ui";
import { AppShell } from "./AppShell";

/** Signed-in area: brand, creator, admin and shared deal pages. */
export default function AppLayout({ children }: { children: ReactNode }) {
	return (
		<AppShell>
			<Suspense fallback={<Loading />}>{children}</Suspense>
		</AppShell>
	);
}
