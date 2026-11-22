"use client";

import { useState } from "react";

type AvatarProps = {
	name: string;
	seed: string;
	/** Diameter in pixels. */
	size?: number;
	/** People get an illustrated face; brands get an abstract logo mark. */
	kind?: "person" | "brand";
};

const STYLES = {
	person: { path: "notionists-neutral", shape: "rounded-full" },
	brand: { path: "shapes", shape: "rounded-lg" }
} as const;

function initialsOf(name: string): string {
	const words = name
		.replace(/\(sample\)/gi, "")
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0);

	return words
		.slice(0, 2)
		.map((word) => word.charAt(0).toUpperCase())
		.join("");
}

/** Decorative: always render the name beside it. */
export function Avatar({ name, seed, size = 40, kind = "person" }: AvatarProps) {
	const { path, shape } = STYLES[kind];
	// Remembering which seed failed lets a new seed retry without an effect.
	const [failedSeed, setFailedSeed] = useState<string | null>(null);
	const dimensions = { width: size, height: size };

	const initials = (
		<span
			aria-hidden="true"
			className={`inline-flex size-full items-center justify-center ${shape} bg-indigo-100 font-semibold text-indigo-800 select-none`}
			style={{ fontSize: Math.round(size * 0.4) }}
		>
			{initialsOf(name)}
		</span>
	);

	if (failedSeed === seed) {
		return (
			<span aria-hidden="true" className="inline-flex shrink-0" style={dimensions}>
				{initials}
			</span>
		);
	}

	// Initials sit under the image so the circle is never blank while the SVG
	// loads or if it fails silently; the SVG's own background covers them.
	return (
		<span
			aria-hidden="true"
			className={`relative inline-flex shrink-0 ${shape} ring-1 ring-zinc-900/5`}
			style={dimensions}
		>
			{initials}
			<img
				src={`https://api.dicebear.com/9.x/${path}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=e0e7ff`}
				alt=""
				{...dimensions}
				onError={() => setFailedSeed(seed)}
				className={`absolute inset-0 ${shape}`}
			/>
		</span>
	);
}
