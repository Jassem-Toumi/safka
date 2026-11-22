"use client";

import type { Me, Role } from "@/shared/contracts";
import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, getMe, signOut } from "@/lib/api";
import { canOpenPath, homePathFor } from "@/lib/routing";
import { MeProvider } from "@/lib/ui/me";

type NavItem = { href: string; label: string };

/** Top-level sections per role (frontend spec §2). No notifications (§8). */
const NAV_ITEMS: Record<Role, readonly NavItem[]> = {
	BRAND: [
		{ href: "/brand/creators", label: "Creators" },
		{ href: "/brand/campaigns", label: "Campaigns" },
		// Products are created inline in the campaign builder (cut for the
		// deadline, Zach 2026-11-22), so there is no Products page.
		{ href: "/brand/deals", label: "Deals" }
	],
	CREATOR: [
		{ href: "/creator/inbox", label: "Inbox" },
		{ href: "/creator/profile", label: "Profile" }
	],
	ADMIN: [{ href: "/admin/disputes", label: "Disputes" }]
};

const ROLE_NAMES: Record<Role, string> = {
	BRAND: "Brand",
	CREATOR: "Creator",
	ADMIN: "Admin"
};

type ShellState =
	| { status: "loading" }
	| { status: "ready"; me: Me }
	| { status: "failed"; message: string };

function isCurrent(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Signed-in frame for every app page: checks the session, keeps each role in
 * its own sections, and provides `useMe()` to the page.
 */
export function AppShell({ children }: { children: ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const [state, setState] = useState<ShellState>({ status: "loading" });
	const [isSwitching, setIsSwitching] = useState(false);

	useEffect(() => {
		let cancelled = false;

		getMe()
			.then((me) => {
				if (!cancelled) {
					setState({ status: "ready", me });
				}
			})
			.catch((error: unknown) => {
				if (cancelled) {
					return;
				}

				if (error instanceof ApiError && error.code === "AUTH_REQUIRED") {
					const returnTo = window.location.pathname + window.location.search;

					router.replace(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
				} else {
					setState({
						status: "failed",
						message:
							error instanceof Error ? error.message : "Something went wrong."
					});
				}
			});

		return () => {
			cancelled = true;
		};
	}, [router]);

	const me = state.status === "ready" ? state.me : null;
	const isAllowed = me !== null && canOpenPath(me, pathname);

	useEffect(() => {
		if (me !== null && !canOpenPath(me, pathname)) {
			router.replace(homePathFor(me));
		}
	}, [me, pathname, router]);

	async function handleSwitchAccount() {
		setIsSwitching(true);

		try {
			await signOut();
		} catch {
			// Picking an account starts a new session anyway, so go regardless.
		}

		// Client-side navigation keeps fixture state (one-tab demo, PLAN.md).
		router.replace("/sign-in");
	}

	if (state.status === "failed") {
		return (
			<main className="mx-auto max-w-md px-4 py-16">
				<div role="alert" className="space-y-3">
					<p>We couldn’t load your account. {state.message}</p>
					<Link
						href="/sign-in"
						className="font-medium text-indigo-700 underline underline-offset-4"
					>
						Go to sign in
					</Link>
				</div>
			</main>
		);
	}

	if (me === null || !isAllowed) {
		return (
			<main className="mx-auto max-w-md px-4 py-16" aria-live="polite">
				<p className="text-zinc-600">Loading…</p>
			</main>
		);
	}

	return (
		<MeProvider me={me}>
			<header className="border-b border-zinc-200/80 bg-white/80 shadow-[0_1px_0_rgb(255_255_255/0.6)] backdrop-blur">
				<div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
					<Link
						href={homePathFor(me)}
						className="inline-flex items-center gap-2 rounded-md text-lg font-bold tracking-tight text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
					>
						<span aria-hidden="true" className="logo-mark size-7 text-sm">
							S
						</span>
						Safka
					</Link>

					<nav aria-label="Main" className="order-last w-full sm:order-none sm:w-auto">
						<ul className="-mx-2 flex flex-wrap gap-1">
							{NAV_ITEMS[me.role].map(({ href, label }) => {
								const current = isCurrent(pathname, href);

								return (
									<li key={href}>
										<Link
											href={href}
											aria-current={current ? "page" : undefined}
											className={`inline-flex min-h-10 items-center rounded-md px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
												current
													? "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-100 ring-inset"
													: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
											}`}
										>
											{label}
										</Link>
									</li>
								);
							})}
						</ul>
					</nav>

					<div className="ml-auto flex items-center gap-3">
						<p className="text-right text-sm leading-tight">
							<span className="block font-medium">{me.displayName}</span>
							<span className="block text-zinc-500">{ROLE_NAMES[me.role]}</span>
						</p>
						<button
							type="button"
							onClick={handleSwitchAccount}
							disabled={isSwitching}
							aria-busy={isSwitching}
							className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium shadow-sm hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
						>
							{isSwitching ? "Switching…" : "Switch account"}
						</button>
					</div>
				</div>
			</header>

			<div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</div>
		</MeProvider>
	);
}
