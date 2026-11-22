"use client";

import type { ThemePreference } from "@/lib/theme";
import type { ReactNode } from "react";

import { useId, useSyncExternalStore } from "react";

import {
	DARK_QUERY,
	isDarkTheme,
	parseThemePreference,
	THEME_ATTRIBUTE,
	THEME_STORAGE_KEY
} from "@/lib/theme";

type ThemeOption = { value: ThemePreference; label: string; icon: ReactNode };

const ICON_PROPS = {
	"aria-hidden": true,
	width: 14,
	height: 14,
	viewBox: "0 0 16 16",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.5,
	strokeLinecap: "round",
	strokeLinejoin: "round"
} as const;

const OPTIONS: readonly ThemeOption[] = [
	{
		value: "light",
		label: "Light",
		icon: (
			<svg {...ICON_PROPS}>
				<circle cx="8" cy="8" r="3" />
				<path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
			</svg>
		)
	},
	{
		value: "dark",
		label: "Dark",
		icon: (
			<svg {...ICON_PROPS}>
				<path d="M13.5 9.6A5.5 5.5 0 0 1 6.4 2.5a5.5 5.5 0 1 0 7.1 7.1Z" />
			</svg>
		)
	},
	{
		value: "system",
		label: "System",
		icon: (
			<svg {...ICON_PROPS}>
				<rect x="1.75" y="2.75" width="12.5" height="8.5" rx="1.25" />
				<path d="M5.5 14h5M8 11.25V14" />
			</svg>
		)
	}
];

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
	try {
		return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
	} catch {
		return parseThemePreference(
			document.documentElement.getAttribute(THEME_ATTRIBUTE)
		);
	}
}

function subscribe(onChange: () => void): () => void {
	function handleStorage(event: StorageEvent) {
		if (event.key === THEME_STORAGE_KEY) {
			onChange();
		}
	}

	listeners.add(onChange);
	window.addEventListener("storage", handleStorage);

	return () => {
		listeners.delete(onChange);
		window.removeEventListener("storage", handleStorage);
	};
}

/** Nothing is selected until the client knows the stored choice. */
function getServerPreference(): ThemePreference | null {
	return null;
}

function choosePreference(preference: ThemePreference) {
	try {
		window.localStorage.setItem(THEME_STORAGE_KEY, preference);
	} catch {
		// Storage can be blocked; the attribute below still carries the choice.
	}

	const root = document.documentElement;

	root.setAttribute(THEME_ATTRIBUTE, preference);
	root.classList.toggle(
		"dark",
		isDarkTheme(preference, window.matchMedia(DARK_QUERY).matches)
	);

	for (const listener of listeners) {
		listener();
	}
}

/**
 * Light / Dark / System as a native radio group, so arrow keys and screen
 * readers work without extra wiring. The head script in the root layout
 * applies the choice before paint and follows the OS while on "System".
 */
export function ThemeSwitcher() {
	const name = useId();
	const preference = useSyncExternalStore(
		subscribe,
		readPreference,
		getServerPreference
	);

	return (
		<fieldset className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-surface-2 p-0.5">
			<legend className="sr-only">Theme</legend>
			{OPTIONS.map(({ value, label, icon }) => (
				<label
					key={value}
					title={label}
					className="inline-flex size-7 cursor-pointer items-center justify-center rounded text-fg-subtle hover:text-fg has-checked:bg-surface has-checked:text-fg has-checked:shadow-panel has-checked:ring-1 has-checked:ring-border has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-focus"
				>
					<input
						type="radio"
						name={name}
						value={value}
						checked={preference === value}
						onChange={() => choosePreference(value)}
						className="sr-only"
					/>
					{icon}
					<span className="sr-only">{label}</span>
				</label>
			))}
		</fieldset>
	);
}
