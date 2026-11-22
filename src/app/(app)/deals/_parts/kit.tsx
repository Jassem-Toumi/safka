"use client";

import type { ReactNode } from "react";
import type { ActorRole, Deal, Role } from "@/shared/contracts";

import { useEffect, useRef } from "react";

export const CARD =
	"min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5";

export const LINK =
	"font-medium text-indigo-700 underline underline-offset-4 hover:text-indigo-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

export const INPUT =
	"block min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-600 aria-invalid:border-red-600 sm:text-sm";

type TagTone = "sample" | "warning" | "success" | "neutral";

const TAG_TONES: Record<TagTone, string> = {
	sample: "bg-amber-100 text-amber-900 ring-amber-300",
	warning: "bg-red-50 text-red-800 ring-red-200",
	success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
	neutral: "bg-zinc-100 text-zinc-700 ring-zinc-300"
};

export function Tag({
	tone,
	children
}: {
	tone: TagTone;
	children: ReactNode;
}) {
	return (
		<span
			className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${TAG_TONES[tone]}`}
		>
			{children}
		</span>
	);
}

/**
 * An inline error that takes focus when it appears or changes, so keyboard
 * and screen reader users land on it (frontend spec §7).
 */
export function FocusAlert({ children }: { children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);
	const text = typeof children === "string" ? children : null;

	useEffect(() => {
		ref.current?.focus();
	}, [text]);

	return (
		<div
			ref={ref}
			tabIndex={-1}
			role="alert"
			className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
		>
			{children}
		</div>
	);
}

const ROLE_WORDS: Record<ActorRole, string> = {
	BRAND: "Brand",
	CREATOR: "Creator",
	ADMIN: "Admin",
	SYSTEM: "Safka"
};

/** "Hushkeys (you)" or "Hushkeys" for a participant; "Admin" otherwise. */
export function actorName(
	deal: Deal,
	role: ActorRole,
	viewerRole: Role
): string {
	const you = role === viewerRole ? " (you)" : "";

	if (role === "BRAND") {
		return `${deal.brand.displayName}${you}`;
	}

	if (role === "CREATOR") {
		return `${deal.creator.displayName}${you}`;
	}

	return `${ROLE_WORDS[role]}${you}`;
}

export function roleWord(role: ActorRole): string {
	return ROLE_WORDS[role];
}

/**
 * Moves focus to the form's first invalid field once React has rendered the
 * errors set in the same event.
 */
export function focusFirstInvalid(form: HTMLFormElement | null) {
	requestAnimationFrame(() => {
		form?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
	});
}
