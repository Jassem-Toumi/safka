import type { Metadata } from "next";

import { Suspense } from "react";

import { AccountPicker } from "./AccountPicker";

export const metadata: Metadata = { title: "Sign in · Safka" };

/**
 * Demo account picker in place of sign-up and passwords (final backend spec
 * §2 and §8). `?returnTo=` brings a person back to a deep link afterwards.
 */
export default function SignInPage() {
	return (
		<main className="mx-auto max-w-md px-4 py-12 sm:py-16">
			<h1 className="text-3xl font-bold tracking-tight text-zinc-950">Sign in to Safka</h1>
			<p className="mt-2 text-zinc-600">
				Choose a demo account. Open each role in its own browser profile, since
				tabs in one profile share a session.
			</p>

			<Suspense
				fallback={<p className="mt-8 text-zinc-600">Loading demo accounts…</p>}
			>
				<AccountPicker />
			</Suspense>

			<p className="mt-10 text-sm text-zinc-500">
				Local demo. All payments are simulated.
			</p>
		</main>
	);
}
