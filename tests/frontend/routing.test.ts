import type { Me } from "@/shared/contracts";

import { describe, expect, it } from "vitest";

import {
	canOpenPath,
	homePathFor,
	postSignInPath,
	safeReturnTo
} from "@/lib/routing";

function user(role: Me["role"], profileReady = true): Me {
	return { id: "user-1", role, displayName: "Someone", profileReady };
}

describe("homePathFor", () => {
	it("sends each role to its landing route (frontend spec §2)", () => {
		expect(homePathFor(user("BRAND"))).toBe("/brand/creators");
		expect(homePathFor(user("CREATOR"))).toBe("/creator/inbox");
		expect(homePathFor(user("ADMIN"))).toBe("/admin/disputes");
	});

	it("sends a creator without a published profile to onboarding", () => {
		expect(homePathFor(user("CREATOR", false))).toBe("/creator/onboarding");
	});
});

describe("safeReturnTo", () => {
	it("keeps same-origin app paths, with their query", () => {
		expect(safeReturnTo("/deals/abc")).toBe("/deals/abc");
		expect(safeReturnTo("/brand/creators?topic=keyboards")).toBe(
			"/brand/creators?topic=keyboards"
		);
	});

	it("denies external and malformed destinations", () => {
		for (const value of [
			null,
			"",
			"deals/abc",
			"//evil.example",
			"/\\evil.example",
			"https://evil.example",
			"javascript:alert(1)",
			"/%2F%2Fevil.example",
			"/api/v1/me",
			"/sign-in"
		]) {
			expect(safeReturnTo(value)).toBeNull();
		}
	});
});

describe("postSignInPath", () => {
	it("follows a safe returnTo that the role can open", () => {
		expect(postSignInPath(user("BRAND"), "/deals/abc")).toBe("/deals/abc");
		expect(postSignInPath(user("CREATOR"), "/creator/profile")).toBe(
			"/creator/profile"
		);
	});

	it("goes home when returnTo belongs to another role or is unsafe", () => {
		expect(postSignInPath(user("BRAND"), "/creator/inbox")).toBe(
			"/brand/creators"
		);
		expect(postSignInPath(user("ADMIN"), "/deals/abc")).toBe(
			"/admin/disputes"
		);
		expect(postSignInPath(user("CREATOR"), "//evil.example")).toBe(
			"/creator/inbox"
		);
	});
});

describe("canOpenPath", () => {
	it("lets each role open only its own sections", () => {
		expect(canOpenPath(user("BRAND"), "/brand/campaigns/new")).toBe(true);
		expect(canOpenPath(user("BRAND"), "/deals/abc")).toBe(true);
		expect(canOpenPath(user("BRAND"), "/creator/inbox")).toBe(false);
		expect(canOpenPath(user("CREATOR"), "/creator/profile")).toBe(true);
		expect(canOpenPath(user("CREATOR"), "/admin/disputes")).toBe(false);
		expect(canOpenPath(user("ADMIN"), "/admin/disputes/x")).toBe(true);
		expect(canOpenPath(user("ADMIN"), "/deals/abc")).toBe(false);
	});

	it("matches whole section names, not prefixes of them", () => {
		expect(canOpenPath(user("BRAND"), "/brandnew")).toBe(false);
		expect(canOpenPath(user("BRAND"), "/brand")).toBe(true);
	});
});
