"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, getMe } from "@/lib/api";
import { homePathFor } from "@/lib/routing";

/** Sends a signed-in person home and everyone else to sign-in. */
export function RootRedirect() {
	const router = useRouter();
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		getMe()
			.then((me) => {
				if (!cancelled) {
					router.replace(homePathFor(me));
				}
			})
			.catch((error: unknown) => {
				if (cancelled) {
					return;
				}

				if (error instanceof ApiError && error.code === "AUTH_REQUIRED") {
					router.replace("/sign-in");
				} else {
					setErrorMessage(
						error instanceof Error ? error.message : "Something went wrong."
					);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [router]);

	return (
		<main className="mx-auto max-w-md px-4 py-16" aria-live="polite">
			{errorMessage === null ? (
				<p className="text-muted">Loading…</p>
			) : (
				<div role="alert" className="space-y-3">
					<p>We couldn’t check whether you’re signed in. {errorMessage}</p>
					<Link
						href="/sign-in"
						className="font-medium text-ink underline underline-offset-4"
					>
						Go to sign in
					</Link>
				</div>
			)}
		</main>
	);
}
