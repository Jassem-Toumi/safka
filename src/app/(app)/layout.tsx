import type { ReactNode } from "react";

import { Suspense } from "react";

import { AppShell } from "@/lib/ui/AppShell";

/** Every signed-in page: session check, role guard, navigation. */
export default function AppLayout({ children }: { children: ReactNode }) {
	return (
		<AppShell>
			<Suspense fallback={<p className="text-fg-muted">Loading…</p>}>
				{children}
			</Suspense>
		</AppShell>
	);
}
