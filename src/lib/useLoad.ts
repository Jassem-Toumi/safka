"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api";

export type LoadState<T> =
	| { status: "loading"; data: null; error: null }
	| { status: "ready"; data: T; error: null }
	| { status: "failed"; data: T | null; error: ApiError | Error };

/**
 * Loads data on mount and whenever `key` changes. `reload()` refetches in the
 * background (keeping current data visible). With `refreshOnFocus`, refetches
 * when the tab regains focus (frontend spec §5).
 */
export function useLoad<T>(load: () => Promise<T>, key: string, options: { refreshOnFocus?: boolean } = {}) {
	const [state, setState] = useState<LoadState<T>>({ status: "loading", data: null, error: null });
	const loadRef = useRef(load);
	const seq = useRef(0);

	loadRef.current = load;

	const run = useCallback(async () => {
		const mine = ++seq.current;

		try {
			const data = await loadRef.current();

			if (mine === seq.current) {
				setState({ status: "ready", data, error: null });
			}

			return data;
		} catch (error) {
			if (mine === seq.current) {
				setState((prev) => ({
					status: "failed",
					data: prev.data,
					error: error instanceof Error ? error : new Error("Something went wrong.")
				}));
			}

			return null;
		}
	}, []);

	useEffect(() => {
		setState({ status: "loading", data: null, error: null });
		void run();
	}, [key, run]);

	useEffect(() => {
		if (!options.refreshOnFocus) {
			return;
		}

		const onFocus = () => {
			if (document.visibilityState === "visible") {
				void run();
			}
		};

		window.addEventListener("focus", onFocus);
		document.addEventListener("visibilitychange", onFocus);

		return () => {
			window.removeEventListener("focus", onFocus);
			document.removeEventListener("visibilitychange", onFocus);
		};
	}, [options.refreshOnFocus, run]);

	return { ...state, reload: run, setData: (data: T) => setState({ status: "ready", data, error: null }) };
}

export function errorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		return error.message;
	}

	return error instanceof Error ? error.message : "Something went wrong.";
}

export function isNotFound(error: unknown): boolean {
	return error instanceof ApiError && error.code === "NOT_FOUND";
}
