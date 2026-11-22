import type { Metadata } from "next";

import { Suspense } from "react";

import { AccountPicker } from "./AccountPicker";

export const metadata: Metadata = { title: "Sign in · Safka" };

/**
 * Account picker in place of sign-up and passwords (final backend spec §2
 * and §8). `?returnTo=` brings a person back to a deep link afterwards.
 * Desktop: photo panel left, picker right. Phones: picker only.
 */
export default function SignInPage() {
	return (
		<div className="grid min-h-dvh lg:grid-cols-2">
			<aside className="relative hidden overflow-hidden lg:block">
				<img
					src="https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=1000&q=70&auto=format&fit=crop"
					alt=""
					width={1600}
					height={1600}
					className="absolute inset-0 size-full object-cover"
				/>
				<div
					aria-hidden="true"
					className="absolute inset-0 bg-gradient-to-t from-zinc-950/85 via-zinc-950/30 to-zinc-950/10"
				/>
				<div className="absolute inset-x-0 bottom-0 p-12 text-white">
					<p className="flex items-center gap-2 text-lg font-semibold">
						<span className="logo-mark inline-flex size-8 items-center justify-center rounded-lg text-sm font-bold">
							S
						</span>
						Safka
					</p>
					<p className="mt-6 max-w-md text-4xl leading-tight font-bold tracking-tight">
						Sponsorships that fit the creator.
					</p>
					<p className="mt-4 max-w-md text-lg text-white/80">
						Find YouTube creators by what they actually make, with sources
						for every claim, and run the deal from offer to payout in one
						place.
					</p>
				</div>
			</aside>

			<main className="flex items-start justify-center px-4 py-12 sm:px-8 lg:py-16">
				<div className="w-full max-w-2xl">
					<h1 className="text-3xl font-bold tracking-tight text-zinc-950">
						Sign in to Safka
					</h1>
					<p className="mt-2 text-zinc-600">Choose an account to continue.</p>

					<Suspense
						fallback={<p className="mt-8 text-zinc-600">Loading accounts…</p>}
					>
						<AccountPicker />
					</Suspense>
				</div>
			</main>
		</div>
	);
}
