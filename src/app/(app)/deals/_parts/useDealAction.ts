"use client";

import type { PendingSubmission } from "@/lib/dealForms";
import type { Deal, DealAction, DealActionInput } from "@/shared/contracts";

import { useRef, useState } from "react";

import { actOnDeal, ApiError, newIdempotencyKey } from "@/lib/api";
import { pickIdempotencyKey } from "@/lib/dealForms";
import { humanizeEvent } from "@/lib/deals";

export type ActionError = {
	action: DealAction;
	message: string;
	fields: Record<string, string>;
};

/** Panel-level outcomes that replace the deal under the viewer's feet. */
export type ActionNotice = { kind: "stale" | "expired"; message: string };

export type DealActionRunner = {
	run: (input: DealActionInput) => Promise<boolean>;
	pending: DealAction | null;
	error: ActionError | null;
	notice: ActionNotice | null;
	announcement: string;
	errorFor: (action: DealAction) => ActionError | null;
};

/** Props every action control takes. */
export type ActionProps = {
	deal: Deal;
	runner: DealActionRunner;
};

type Options = {
	onDeal: (deal: Deal) => void;
	reload: () => void;
};

export const STALE_MESSAGE =
	"This deal changed since you opened it. Review and try again.";

function describeFailure(error: unknown): {
	message: string;
	fields: Record<string, string>;
} {
	if (error instanceof ApiError) {
		return { message: error.message, fields: error.fields };
	}

	return {
		message:
			"We couldn’t reach the server. Your input is kept, so you can try again.",
		fields: {}
	};
}

/**
 * Sends deal actions: one idempotency key per intentional submission (reused
 * when the same payload is retried after a failure), never resubmits after a
 * stale or expired response, and hands the returned deal to `onDeal`.
 */
export function useDealAction(
	dealId: string,
	{ onDeal, reload }: Options
): DealActionRunner {
	const [pending, setPending] = useState<DealAction | null>(null);
	const [error, setError] = useState<ActionError | null>(null);
	const [notice, setNotice] = useState<ActionNotice | null>(null);
	const [announcement, setAnnouncement] = useState("");
	const failedRef = useRef<PendingSubmission | null>(null);

	async function run(input: DealActionInput): Promise<boolean> {
		const fingerprint = JSON.stringify(input);
		const key = pickIdempotencyKey(
			failedRef.current,
			fingerprint,
			newIdempotencyKey
		);

		setPending(input.action);
		setError(null);
		setNotice(null);
		setAnnouncement("");

		try {
			const deal = await actOnDeal(dealId, input, key);

			failedRef.current = null;
			onDeal(deal);
			setAnnouncement(`${humanizeEvent(input.action)}.`);

			return true;
		} catch (caught) {
			failedRef.current = { key, fingerprint };

			if (caught instanceof ApiError && caught.code === "STALE_DEAL") {
				setNotice({ kind: "stale", message: STALE_MESSAGE });
				reload();
			} else if (
				caught instanceof ApiError &&
				caught.code === "PROPOSAL_EXPIRED"
			) {
				setNotice({
					kind: "expired",
					message:
						"This offer expired before your response went through, so it can’t be accepted or countered any more."
				});
				reload();
			} else {
				setError({ action: input.action, ...describeFailure(caught) });
			}

			return false;
		} finally {
			setPending(null);
		}
	}

	function errorFor(action: DealAction): ActionError | null {
		return error?.action === action ? error : null;
	}

	return { run, pending, error, notice, announcement, errorFor };
}
