import { describe, expect, it } from "vitest";

import {
	isDarkTheme,
	parseThemePreference,
	THEME_ATTRIBUTE,
	THEME_INIT_SCRIPT,
	THEME_STORAGE_KEY
} from "@/lib/theme";

type FakePage = {
	isDark: () => boolean;
	setSystemDark: (dark: boolean) => void;
	setStored: (value: string | null) => void;
	fireStorage: (key: string) => void;
};

/** Runs the head script against a minimal stand-in for the browser. */
function runInitScript({
	stored,
	systemDark,
	storageThrows = false,
	attribute = null
}: {
	stored: string | null;
	systemDark: boolean;
	storageThrows?: boolean;
	attribute?: string | null;
}): FakePage {
	const classes = new Set<string>();
	const mediaListeners: (() => void)[] = [];
	const storageListeners: ((event: { key: string }) => void)[] = [];
	let storedValue = stored;
	const media = { matches: systemDark };

	const document = {
		documentElement: {
			classList: {
				toggle(name: string, force: boolean) {
					if (force) {
						classes.add(name);
					} else {
						classes.delete(name);
					}
				}
			},
			getAttribute(name: string) {
				return name === THEME_ATTRIBUTE ? attribute : null;
			}
		}
	};
	const window = {
		matchMedia: () => ({
			get matches() {
				return media.matches;
			},
			addEventListener: (_type: string, listener: () => void) => {
				mediaListeners.push(listener);
			}
		}),
		localStorage: {
			getItem(key: string) {
				if (storageThrows) {
					throw new Error("SecurityError");
				}

				return key === THEME_STORAGE_KEY ? storedValue : null;
			}
		},
		addEventListener: (
			_type: string,
			listener: (event: { key: string }) => void
		) => {
			storageListeners.push(listener);
		}
	};

	new Function("window", "document", THEME_INIT_SCRIPT)(window, document);

	return {
		isDark: () => classes.has("dark"),
		setSystemDark: (dark) => {
			media.matches = dark;

			for (const listener of mediaListeners) {
				listener();
			}
		},
		setStored: (value) => {
			storedValue = value;
		},
		fireStorage: (key) => {
			for (const listener of storageListeners) {
				listener({ key });
			}
		}
	};
}

describe("parseThemePreference", () => {
	it("keeps light and dark and treats anything else as system", () => {
		expect(parseThemePreference("light")).toBe("light");
		expect(parseThemePreference("dark")).toBe("dark");
		expect(parseThemePreference("system")).toBe("system");
		expect(parseThemePreference(null)).toBe("system");
		expect(parseThemePreference("purple")).toBe("system");
	});
});

describe("isDarkTheme", () => {
	it("follows an explicit choice and the system otherwise", () => {
		expect(isDarkTheme("dark", false)).toBe(true);
		expect(isDarkTheme("light", true)).toBe(false);
		expect(isDarkTheme("system", true)).toBe(true);
		expect(isDarkTheme("system", false)).toBe(false);
	});
});

describe("THEME_INIT_SCRIPT", () => {
	it("applies a stored choice before paint, whatever the system says", () => {
		expect(runInitScript({ stored: "dark", systemDark: false }).isDark()).toBe(
			true
		);
		expect(runInitScript({ stored: "light", systemDark: true }).isDark()).toBe(
			false
		);
	});

	it("follows the system with no stored choice, and keeps following it", () => {
		const page = runInitScript({ stored: null, systemDark: true });

		expect(page.isDark()).toBe(true);
		page.setSystemDark(false);
		expect(page.isDark()).toBe(false);
	});

	it("ignores system changes while a choice is stored", () => {
		const page = runInitScript({ stored: "light", systemDark: false });

		page.setSystemDark(true);
		expect(page.isDark()).toBe(false);
	});

	it("picks up a choice made in another tab", () => {
		const page = runInitScript({ stored: "light", systemDark: false });

		page.setStored("dark");
		page.fireStorage("unrelated");
		expect(page.isDark()).toBe(false);
		page.fireStorage(THEME_STORAGE_KEY);
		expect(page.isDark()).toBe(true);
	});

	it("falls back to the page attribute, then the system, when storage throws", () => {
		expect(
			runInitScript({
				stored: "light",
				systemDark: true,
				storageThrows: true
			}).isDark()
		).toBe(true);
		expect(
			runInitScript({
				stored: null,
				systemDark: true,
				storageThrows: true,
				attribute: "light"
			}).isDark()
		).toBe(false);
	});
});
