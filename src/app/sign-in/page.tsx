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
			<figure className="relative mb-8 overflow-hidden rounded-2xl shadow-sm ring-1 ring-zinc-900/5">
				<img
					src="https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=1200&q=75&auto=format&fit=crop"
					alt=""
					width={1200}
					height={480}
					className="h-40 w-full object-cover sm:h-48"
				/>
				<div
					aria-hidden="true"
					className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-zinc-950/10 to-transparent"
				/>
				<p className="absolute bottom-3 left-4 text-lg font-semibold text-white">
					Sponsorships that fit the creator.
				</p>
				<figcaption className="absolute right-3 bottom-3 text-[10px] text-white/70">
					Photo: Unsplash
				</figcaption>
			</figure>
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
