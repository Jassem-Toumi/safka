"use client";

import type { DependencyList } from "react";

import { useCallback, useEffect, useRef, useState } from "react";

export type LoadResult<T> =
	| { status: "loading"; data: T | null; error: null; reload: () => void }
	| { status: "ready"; data: T; error: null; reload: () => void }
	| { status: "failed"; data: T | null; error: Error; reload: () => void };

type LoadOptions = {
	/** Refetch when the tab regains focus (frontend spec §5, deal pages). */
	refetchOnFocus?: boolean;
};

/**
 * Runs `load` on mount and whenever `deps` change, ignoring results that
 * arrive after a newer load started or the component unmounted. A reload
 * keeps the previous data visible while it runs.
 */
export function useLoad<T>(
	load: () => Promise<T>,
	deps: DependencyList,
	options: LoadOptions = {}
): LoadResult<T> {
	const { refetchOnFocus = false } = options;
	const [state, setState] = useState<{
		status: "loading" | "ready" | "failed";
		data: T | null;
		error: Error | null;
	}>({ status: "loading", data: null, error: null });
	const [attempt, setAttempt] = useState(0);
	const loadRef = useRef(load);

	loadRef.current = load;

	const reload = useCallback(() => setAttempt((count) => count + 1), []);

	useEffect(() => {
		let cancelled = false;

		setState((previous) => ({ ...previous, status: "loading", error: null }));
		loadRef
			.current()
			.then((data) => {
				if (!cancelled) {
					setState({ status: "ready", data, error: null });
				}
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setState((previous) => ({
						status: "failed",
						data: previous.data,
						error: error instanceof Error ? error : new Error(String(error))
					}));
				}
			});

		return () => {
			cancelled = true;
		};

		// `deps` stand in for `load`'s inputs, as with useEffect itself.
	}, [...deps, attempt]);

	useEffect(() => {
		if (!refetchOnFocus) {
			return;
		}

		function handleFocus() {
			if (document.visibilityState === "visible") {
				reload();
			}
		}

		window.addEventListener("focus", handleFocus);
		document.addEventListener("visibilitychange", handleFocus);

		return () => {
			window.removeEventListener("focus", handleFocus);
			document.removeEventListener("visibilitychange", handleFocus);
		};
	}, [refetchOnFocus, reload]);

	const { status, data, error } = state;

	if (status === "ready" && data !== null) {
		return { status, data, error: null, reload };
	}

	if (status === "failed" && error !== null) {
		return { status, data, error, reload };
	}

	return { status: "loading", data, error: null, reload };
}
