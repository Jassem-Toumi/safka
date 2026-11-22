export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "safka-theme";

export const THEME_PREFERENCES: readonly ThemePreference[] = [
	"light",
	"dark",
	"system"
];

/**
 * Mirrors the choice on <html> so it survives a browser that blocks storage
 * (the switcher writes both; the head script reads this when storage throws).
 */
export const THEME_ATTRIBUTE = "data-theme-preference";

export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Anything other than a stored "light" or "dark" means follow the system. */
export function parseThemePreference(value: string | null): ThemePreference {
	return value === "light" || value === "dark" ? value : "system";
}

export function isDarkTheme(
	preference: ThemePreference,
	systemPrefersDark: boolean
): boolean {
	return preference === "dark" || (preference === "system" && systemPrefersDark);
}

/**
 * Runs in <head> before first paint so the page never flashes the wrong
 * theme. It also keeps "System" in step with the OS setting and other tabs,
 * whether or not a theme switcher is on the page. Keep it in sync with
 * `parseThemePreference` and `isDarkTheme` (tests/frontend/theme.test.ts).
 */
export const THEME_INIT_SCRIPT = `(function () {
	var key = ${JSON.stringify(THEME_STORAGE_KEY)};
	var media = window.matchMedia(${JSON.stringify(DARK_QUERY)});
	function read() {
		var value = null;
		try {
			value = window.localStorage.getItem(key);
		} catch (error) {
			value = document.documentElement.getAttribute(${JSON.stringify(THEME_ATTRIBUTE)});
		}
		return value === "light" || value === "dark" ? value : "system";
	}
	function apply() {
		var preference = read();
		var dark = preference === "dark" || (preference === "system" && media.matches);
		document.documentElement.classList.toggle("dark", dark);
	}
	apply();
	media.addEventListener("change", apply);
	window.addEventListener("storage", function (event) {
		if (event.key === key) {
			apply();
		}
	});
})();`;
