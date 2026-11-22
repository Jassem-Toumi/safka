import type { Me } from "@/shared/contracts";

/** Where a signed-in person lands (frontend spec §2). */
export function homePathFor(me: Me): string {
	switch (me.role) {
		case "BRAND":
			return "/brand/creators";

		case "CREATOR":
			return me.profileReady ? "/creator/inbox" : "/creator/onboarding";

		case "ADMIN":
			return "/admin/disputes";
	}
}

/**
 * Returns `value` if it is a same-origin app path that is safe to navigate
 * to after sign-in, else null. Denies protocol-relative and backslash tricks,
 * encoded slashes, API routes, and the sign-in page itself.
 */
export function safeReturnTo(value: string | null): string | null {
	if (value === null || !value.startsWith("/")) {
		return null;
	}

	let decoded: string;

	try {
		decoded = decodeURIComponent(value);
	} catch {
		return null;
	}

	if (/^[/\\]{2}|^\/\\/.test(decoded) || decoded.includes("\\")) {
		return null;
	}

	const url = new URL(value, "http://app.local");

	if (
		url.origin !== "http://app.local" ||
		url.pathname.startsWith("/api/") ||
		url.pathname === "/sign-in"
	) {
		return null;
	}

	return url.pathname + url.search;
}

const ROLE_SECTIONS: Record<Me["role"], readonly string[]> = {
	BRAND: ["brand", "deals"],
	CREATOR: ["creator", "deals"],
	ADMIN: ["admin"]
};

/** Whether the role may open `path`, judged by its first path segment. */
export function canOpenPath(me: Me, path: string): boolean {
	const [section = ""] = path.split(/[?#]/)[0]?.split("/").filter(Boolean) ?? [];

	return ROLE_SECTIONS[me.role].includes(section);
}

/** A safe returnTo the role can open, or the role's home. */
export function postSignInPath(me: Me, returnTo: string | null): string {
	const path = safeReturnTo(returnTo);

	if (path !== null && canOpenPath(me, path)) {
		return path;
	}

	return homePathFor(me);
}
