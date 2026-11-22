"use client";

import type { Me } from "@/shared/contracts";
import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

import { ApiError, getMe, signOut } from "@/lib/api";
import { homePathFor } from "@/lib/routing";

import { Button, ButtonLink, cx, Loading } from "../_components/ui";

const MeContext = createContext<Me | null>(null);

/** The signed-in person. Only usable under the app shell. */
export function useMe(): Me {
	const me = useContext(MeContext);

	if (me === null) {
		throw new Error("useMe() must be used inside <AppShell>.");
	}

	return me;
}

const NAV: Record<Me["role"], readonly { href: string; label: string }[]> = {
	BRAND: [
		{ href: "/brand/creators", label: "Creators" },
		{ href: "/brand/campaigns", label: "Campaigns" },
		{ href: "/brand/deals", label: "Deals" },
		{ href: "/brand/products", label: "Products" }
	],
	CREATOR: [
		{ href: "/creator/inbox", label: "Inbox" },
		{ href: "/creator/profile", label: "Profile" }
	],
	ADMIN: [{ href: "/admin/disputes", label: "Disputes" }]
};

const ALLOWED_PREFIXES: Record<Me["role"], readonly string[]> = {
	BRAND: ["/brand/", "/deals/"],
	CREATOR: ["/creator/", "/deals/"],
	ADMIN: ["/admin/", "/deals/"]
};

export function AppShell({ children }: { children: ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const [me, setMe] = useState<Me | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const [signingOut, setSigningOut] = useState(false);

	useEffect(() => {
		let cancelled = false;

		getMe()
			.then((value) => {
				if (!cancelled) {
					setMe(value);
				}
			})
			.catch((error: unknown) => {
				if (cancelled) {
					return;
				}

				if (error instanceof ApiError && error.code === "AUTH_REQUIRED") {
					router.replace(`/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
				} else {
					setFailure(error instanceof Error ? error.message : "Something went wrong.");
				}
			});

		return () => {
			cancelled = true;
		};
	}, [router]);

	useEffect(() => setMenuOpen(false), [pathname]);

	// Keep profileReady etc. current after in-app changes (e.g. publishing a profile then landing in the inbox).
	useEffect(() => {
		if (me === null) return;

		getMe()
			.then((value) => setMe((prev) => (prev && JSON.stringify(prev) === JSON.stringify(value) ? prev : value)))
			.catch(() => {});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pathname]);

	if (failure !== null) {
		return (
			<main className="mx-auto max-w-md px-4 py-16" role="alert">
				<p className="font-medium">We couldn’t load your session.</p>
				<p className="mt-1 text-sm text-muted">{failure}</p>
				<ButtonLink href="/sign-in" variant="secondary" className="mt-4">
					Go to sign in
				</ButtonLink>
			</main>
		);
	}

	if (me === null) {
		return (
			<main className="mx-auto max-w-6xl px-4">
				<Loading />
			</main>
		);
	}

	const allowed = ALLOWED_PREFIXES[me.role].some((prefix) => pathname.startsWith(prefix));

	async function handleSignOut() {
		setSigningOut(true);

		try {
			await signOut();
		} finally {
			router.replace("/sign-in");
		}
	}

	return (
		<MeContext.Provider value={me}>
			<div className="min-h-dvh">
				<header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
					<div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
						<Link href={homePathFor(me)} className="flex items-center gap-2 font-semibold tracking-tight">
							<span aria-hidden="true" className="grid size-6 place-items-center rounded-md bg-ink text-[11px] font-bold text-accent">
								S
							</span>
							Safka
						</Link>

						<nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
							{NAV[me.role].map((item) => (
								<NavLink key={item.href} href={item.href} active={pathname.startsWith(item.href)}>
									{item.label}
								</NavLink>
							))}
						</nav>

						<div className="ml-auto hidden items-center gap-3 md:flex">
							<span className="text-sm text-muted">
								{me.displayName}
								<span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs">{roleName(me.role)}</span>
							</span>
							<Button variant="ghost" onClick={handleSignOut} busy={signingOut}>
								Sign out
							</Button>
						</div>

						<button
							type="button"
							className="ml-auto rounded-full border border-line-strong px-3 py-1.5 text-sm md:hidden"
							aria-expanded={menuOpen}
							aria-controls="mobile-menu"
							onClick={() => setMenuOpen((open) => !open)}
						>
							Menu
						</button>
					</div>

					{menuOpen ? (
						<nav id="mobile-menu" aria-label="Main" className="border-t border-line px-4 py-3 md:hidden">
							<ul className="space-y-1">
								{NAV[me.role].map((item) => (
									<li key={item.href}>
										<NavLink href={item.href} active={pathname.startsWith(item.href)} block>
											{item.label}
										</NavLink>
									</li>
								))}
							</ul>
							<div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm text-muted">
								<span>
									{me.displayName} · {roleName(me.role)}
								</span>
								<Button variant="ghost" onClick={handleSignOut} busy={signingOut}>
									Sign out
								</Button>
							</div>
						</nav>
					) : null}
				</header>

				<main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
					{allowed ? children : <NotAvailable home={homePathFor(me)} />}
				</main>

				<footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-faint sm:px-6">
					Local demo · All payments are simulated · Sample data is labeled where it appears
				</footer>
			</div>
		</MeContext.Provider>
	);
}

function NavLink({ href, active, block = false, children }: { href: string; active: boolean; block?: boolean; children: ReactNode }) {
	return (
		<Link
			href={href}
			aria-current={active ? "page" : undefined}
			className={cx(
				"rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
				block && "block",
				active ? "bg-ink text-white" : "text-ink-soft hover:bg-line/60"
			)}
		>
			{children}
		</Link>
	);
}

function roleName(role: Me["role"]): string {
	return role === "BRAND" ? "Brand" : role === "CREATOR" ? "Creator" : "Admin";
}

/** Generic copy for anything this person can't open (frontend spec §2). */
export function NotAvailable({ home }: { home: string }) {
	return (
		<div className="mx-auto max-w-md py-16 text-center">
			<p className="text-lg font-semibold">This page isn’t available</p>
			<p className="mt-1 text-sm text-muted">It may not exist, or your account can’t open it.</p>
			<ButtonLink href={home} variant="secondary" className="mt-5">
				Back to home
			</ButtonLink>
		</div>
	);
}
