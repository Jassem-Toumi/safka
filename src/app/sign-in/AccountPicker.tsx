"use client";

import type { DemoAccount, Role } from "@/shared/contracts";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, listDemoAccounts, signIn } from "@/lib/api";
import { postSignInPath } from "@/lib/routing";
import { Avatar } from "@/lib/ui/Avatar";

type LoadState =
	| { status: "loading" }
	| { status: "ready"; accounts: DemoAccount[] }
	| { status: "failed"; message: string };

const ROLE_SECTIONS: readonly { role: Role; heading: string; hint: string }[] =
	[
		{
			role: "BRAND",
			heading: "Brands",
			hint: "Find creators, run campaigns and send offers."
		},
		{
			role: "CREATOR",
			heading: "Creators",
			hint: "Publish a profile and handle offers from your inbox."
		},
		{ role: "ADMIN", heading: "Admin", hint: "Review and resolve disputes." }
	];

// The backend accepts only its configured loopback origin (DECISIONS.md D3).
const APP_ORIGIN = "http://127.0.0.1:3000";

function describeError(error: unknown): string {
	if (error instanceof ApiError) {
		return error.message;
	}

	return "The server didn’t respond. Check that it is running.";
}

export function AccountPicker() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
	const [attempt, setAttempt] = useState(0);
	const [pendingAccountId, setPendingAccountId] = useState<string | null>(
		null
	);
	const [signInError, setSignInError] = useState<string | null>(null);
	const [wrongHost, setWrongHost] = useState(false);

	useEffect(() => {
		setWrongHost(window.location.origin !== APP_ORIGIN);
	}, []);

	useEffect(() => {
		let cancelled = false;

		setLoadState({ status: "loading" });
		listDemoAccounts()
			.then(({ items }) => {
				if (!cancelled) {
					setLoadState({ status: "ready", accounts: items });
				}
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setLoadState({ status: "failed", message: describeError(error) });
				}
			});

		return () => {
			cancelled = true;
		};
	}, [attempt]);

	async function handleSelect(account: DemoAccount) {
		setPendingAccountId(account.id);
		setSignInError(null);

		try {
			const me = await signIn(account.id);

			router.replace(postSignInPath(me, searchParams.get("returnTo")));
		} catch (error) {
			setPendingAccountId(null);
			setSignInError(`Couldn’t sign in as ${account.displayName}. ${describeError(error)}`);
		}
	}

	if (wrongHost) {
		return (
			<div
				role="alert"
				className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-4"
			>
				<p className="font-medium">Open Safka at {APP_ORIGIN}</p>
				<p className="mt-1 text-sm text-zinc-700">
					The local server only accepts that address, so sign-in won’t work
					from here.
				</p>
				<a
					href={`${APP_ORIGIN}/sign-in`}
					className="mt-3 inline-block font-medium text-indigo-700 underline underline-offset-4"
				>
					Go to {APP_ORIGIN}
				</a>
			</div>
		);
	}

	if (loadState.status === "loading") {
		return (
			<p className="mt-8 text-zinc-600" aria-live="polite">
				Loading accounts…
			</p>
		);
	}

	if (loadState.status === "failed") {
		return (
			<div role="alert" className="mt-8 space-y-3">
				<p>Couldn’t load accounts. {loadState.message}</p>
				<button
					type="button"
					onClick={() => setAttempt((count) => count + 1)}
					className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-medium shadow-sm hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
				>
					Try again
				</button>
			</div>
		);
	}

	const isPending = pendingAccountId !== null;

	return (
		<div className="mt-8 space-y-8">
			<p aria-live="assertive" className="empty:hidden" role="alert">
				{signInError}
			</p>
			<p aria-live="polite" className="sr-only">
				{isPending ? "Signing in…" : ""}
			</p>

			{ROLE_SECTIONS.map(({ role, heading, hint }) => {
				const accounts = loadState.accounts.filter(
					(account) => account.role === role
				);

				if (accounts.length === 0) {
					return null;
				}

				return (
					<section key={role} aria-labelledby={`role-${role}`}>
						<h2 id={`role-${role}`} className="text-lg font-semibold tracking-tight">
							{heading}
						</h2>
						<p className="text-sm text-zinc-600">{hint}</p>
						<ul className="mt-3 grid gap-2 sm:grid-cols-2">
							{accounts.map((account) => {
								const isThisPending = pendingAccountId === account.id;

								return (
									<li key={account.id}>
										<button
											type="button"
											onClick={() => handleSelect(account)}
											disabled={isPending}
											aria-busy={isThisPending}
											className="group flex h-16 w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left font-medium shadow-sm transition hover:border-indigo-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
										>
											<span className="flex min-w-0 items-center gap-3">
												<Avatar
													name={account.displayName}
													seed={account.id}
													size={40}
													kind={account.role === "BRAND" ? "brand" : "person"}
												/>
												<span className="truncate" title={account.displayName}>
													<span className="sr-only">Sign in as </span>
													{account.displayName}
												</span>
											</span>
											<span
												aria-hidden="true"
												className="shrink-0 text-sm font-normal whitespace-nowrap text-zinc-500 group-hover:text-indigo-700"
											>
												{isThisPending ? "Signing in…" : "Sign in"}
											</span>
										</button>
									</li>
								);
							})}
						</ul>
					</section>
				);
			})}
		</div>
	);
}
