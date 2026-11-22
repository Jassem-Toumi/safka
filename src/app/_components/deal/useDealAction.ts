"use client";

import type { Deal, DealActionInput } from "@/shared/contracts";

import { useRef, useState } from "react";

import { actOnDeal, ApiError, newIdempotencyKey } from "@/lib/api";

/** DealActionInput without `expectedVersion`, kept as a union per action. */
export type ActionPayload = DealActionInput extends infer A ? (A extends DealActionInput ? Omit<A, "expectedVersion"> : never) : never;

export type ActionNotice = { tone: "danger" | "info" | "warning"; text: string; expired?: boolean };

/**
 * Sends one deal action with the last rendered `expectedVersion`. One idempotency
 * key per intentional submission, reused only when retrying the same payload
 * after a transport failure (frontend spec §7). Never moves state optimistically.
 */
export function useDealAction(deal: Deal, onDeal: (deal: Deal) => void, reload: () => Promise<unknown>) {
	const [pending, setPending] = useState<DealActionInput["action"] | null>(null);
	const [notice, setNotice] = useState<ActionNotice | null>(null);
	const retry = useRef<{ payload: string; key: string } | null>(null);

	async function act(input: ActionPayload): Promise<boolean> {
		const payload = { ...input, expectedVersion: deal.version } as DealActionInput;
		const fingerprint = JSON.stringify(payload);
		const key = retry.current?.payload === fingerprint ? retry.current.key : newIdempotencyKey();

		retry.current = { payload: fingerprint, key };
		setPending(input.action);
		setNotice(null);

		try {
			onDeal(await actOnDeal(deal.id, payload, key));
			retry.current = null;

			return true;
		} catch (error) {
			if (!(error instanceof ApiError)) {
				setNotice({ tone: "danger", text: "The server didn’t respond. Try again; it’s safe to retry." });

				return false;
			}

			retry.current = null;

			if (error.code === "STALE_DEAL") {
				await reload();
				setNotice({ tone: "info", text: "This deal changed since you opened it. Review the latest state before acting." });
			} else if (error.code === "PROPOSAL_EXPIRED") {
				await reload();
				setNotice({ tone: "warning", text: "This proposal expired after 7 days.", expired: true });
			} else if (error.code === "BUDGET_EXCEEDED") {
				setNotice({ tone: "danger", text: "Accepting would exceed the campaign’s remaining budget. The offer stays open; counter lower or raise the budget." });
			} else {
				const fields = Object.values(error.fields);

				setNotice({ tone: "danger", text: fields.length ? `${error.message} ${fields.join(" ")}` : error.message });
			}

			return false;
		} finally {
			setPending(null);
		}
	}

	return { act, pending, notice, setNotice };
}
