"use client";

import type { ReactNode } from "react";
import type { ActorRole, Deal, Role } from "@/shared/contracts";

import { useEffect, useRef } from "react";

export const CARD =
	"min-w-0 rounded-lg border border-border bg-surface p-4 shadow-panel sm:p-5";

export const LINK =
	"font-medium text-accent-text underline underline-offset-4 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export const INPUT =
	"block min-h-11 sm:min-h-9 w-full rounded-md border border-border-strong bg-surface dark:bg-surface-2 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus aria-invalid:border-danger sm:text-sm";

type TagTone = "sample" | "warning" | "success" | "neutral";

const TAG_TONES: Record<TagTone, string> = {
	sample: "bg-warning-soft text-warning ring-warning-line",
	warning: "bg-danger-soft text-danger ring-danger-line",
	success: "bg-success-soft text-success ring-success-line",
	neutral: "bg-surface-3 text-fg-secondary ring-border-strong"
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
			className="rounded-md border border-danger-line bg-danger-soft p-3 text-sm text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
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
