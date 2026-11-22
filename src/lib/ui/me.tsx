"use client";

import type { Me } from "@/shared/contracts";
import type { ReactNode } from "react";

import { createContext, useContext } from "react";

const MeContext = createContext<Me | null>(null);

/** Provided by AppShell once the signed-in person is known. */
export function MeProvider({ me, children }: { me: Me; children: ReactNode }) {
	return <MeContext value={me}>{children}</MeContext>;
}

/** The signed-in person. Only valid inside AppShell's pages. */
export function useMe(): Me {
	const me = useContext(MeContext);

	if (me === null) {
		throw new Error("useMe() must be used inside AppShell.");
	}

	return me;
}
