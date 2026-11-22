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
		<div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
			<section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
				<div className="flex items-center gap-2 font-semibold tracking-tight">
					<span aria-hidden="true" className="grid size-7 place-items-center rounded-md bg-accent text-xs font-bold text-ink">
						S
					</span>
					Safka
				</div>
				<div>
					<h2 className="max-w-md text-5xl leading-[1.05] font-semibold tracking-tight text-balance">
						Creator sponsorships, <span className="text-accent">from brief to payout.</span>
					</h2>
					<p className="mt-6 max-w-md text-white/60">
						Find creators by the work they’ve actually published, agree terms, review drafts and release payment, all with every number sourced.
					</p>
				</div>
				<dl className="grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-6 text-sm">
					<div>
						<dt className="text-white/50">Evidence</dt>
						<dd className="mt-1 font-medium">Live via You.com</dd>
					</div>
					<div>
						<dt className="text-white/50">Budgets</dt>
						<dd className="mt-1 font-medium">Hard caps</dd>
					</div>
					<div>
						<dt className="text-white/50">Payments</dt>
						<dd className="mt-1 font-medium">Simulated</dd>
					</div>
				</dl>
			</section>

			<main className="mx-auto w-full max-w-md px-4 py-12 sm:py-16 lg:py-20">
				<h1 className="text-3xl font-semibold tracking-tight">Sign in to Safka</h1>
				<p className="mt-2 text-muted">
					Choose a demo account. Open each role in its own browser profile, since tabs in one profile share a session.
				</p>

				<Suspense fallback={<p className="mt-8 text-muted">Loading demo accounts…</p>}>
					<AccountPicker />
				</Suspense>

				<p className="mt-10 text-sm text-faint">Local demo. All payments are simulated.</p>
			</main>
		</div>
	);
}
