import type { Metadata } from "next";

import { Suspense } from "react";

import { ThemeSwitcher } from "@/lib/ui/ThemeSwitcher";

import { AccountPicker } from "./AccountPicker";

export const metadata: Metadata = { title: "Sign in · Safka" };

/**
 * Demo account picker in place of sign-up and passwords (final backend spec
 * §2 and §8). `?returnTo=` brings a person back to a deep link afterwards.
 */
export default function SignInPage() {
	return (
		<main className="mx-auto max-w-md px-4 py-12 sm:py-16">
			<div className="flex items-start justify-between gap-4">
				<h1 className="text-2xl font-semibold tracking-tight">Sign in to Safka</h1>
				<ThemeSwitcher />
			</div>
			<p className="mt-2 text-fg-muted">
				Choose a demo account. Open each role in its own browser profile, since
				tabs in one profile share a session.
			</p>

			<Suspense
				fallback={<p className="mt-8 text-fg-muted">Loading demo accounts…</p>}
			>
				<AccountPicker />
			</Suspense>

			<p className="mt-10 text-sm text-fg-subtle">
				Local demo. All payments are simulated.
			</p>
		</main>
	);
}
