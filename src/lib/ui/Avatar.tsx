"use client";

import { useState } from "react";

type AvatarProps = {
	name: string;
	seed: string;
	/** Diameter in pixels. */
	size?: number;
};

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
export function Avatar({ name, seed, size = 40 }: AvatarProps) {
	// Remembering which seed failed lets a new seed retry without an effect.
	const [failedSeed, setFailedSeed] = useState<string | null>(null);
	const dimensions = { width: size, height: size };

	if (failedSeed === seed) {
		return (
			<span
				aria-hidden="true"
				className="inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-medium text-zinc-700 select-none"
				style={{ ...dimensions, fontSize: Math.round(size * 0.4) }}
			>
				{initialsOf(name)}
			</span>
		);
	}

	return (
		<img
			src={`https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${encodeURIComponent(seed)}`}
			alt=""
			{...dimensions}
			onError={() => setFailedSeed(seed)}
			className="shrink-0 rounded-full bg-zinc-100"
		/>
	);
}
