import type { Budget } from "@/shared/contracts";

import { formatCents } from "@/lib/format";

type BudgetBarProps = {
	budget: Budget | null;
};

function percentOf(part: number, total: number): number {
	if (total <= 0) {
		return 0;
	}

	return Math.min(100, Math.max(0, (part / total) * 100));
}

export function BudgetBar({ budget }: BudgetBarProps) {
	if (budget === null) {
		return null;
	}

	const spentPct = percentOf(budget.spentCents, budget.budgetCents);
	const committedPct = Math.min(
		100 - spentPct,
		percentOf(budget.committedCents, budget.budgetCents)
	);

	return (
		<div className="space-y-3">
			<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div>
					<dt className="text-sm text-fg-muted">Total</dt>
					<dd className="font-medium tabular-nums">
						{formatCents(budget.budgetCents)}
					</dd>
				</div>
				<div>
					<dt className="flex items-center gap-1.5 text-sm text-fg-muted">
						<span
							aria-hidden="true"
							className="size-2.5 rounded-sm bg-accent-muted"
						/>
						Committed
					</dt>
					<dd className="font-medium tabular-nums">
						{formatCents(budget.committedCents)}
					</dd>
				</div>
				<div>
					<dt className="flex items-center gap-1.5 text-sm text-fg-muted">
						<span
							aria-hidden="true"
							className="size-2.5 rounded-sm bg-accent"
						/>
						Spent
					</dt>
					<dd className="font-medium tabular-nums">
						{formatCents(budget.spentCents)}
					</dd>
				</div>
				<div>
					<dt className="text-sm text-fg-muted">Remaining</dt>
					<dd className="font-medium tabular-nums">
						{formatCents(budget.remainingCents)}
					</dd>
				</div>
			</dl>
			<div
				aria-hidden="true"
				className="flex h-2 overflow-hidden rounded-full bg-fill"
			>
				<div className="bg-accent" style={{ width: `${spentPct}%` }} />
				<div className="bg-accent-muted" style={{ width: `${committedPct}%` }} />
			</div>
			<p className="text-sm text-fg-subtle">Agreed deals reserve budget</p>
		</div>
	);
}
