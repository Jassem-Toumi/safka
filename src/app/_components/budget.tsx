"use client";

import type { Budget } from "@/shared/contracts";

import { formatCents } from "@/lib/format";

/** Total / committed / spent / remaining with a single stacked bar. */
export function BudgetBar({ budget, compact = false }: { budget: Budget; compact?: boolean }) {
	const total = Math.max(budget.budgetCents, 1);
	const spentPct = Math.min(100, (100 * budget.spentCents) / total);
	const committedPct = Math.min(100 - spentPct, (100 * budget.committedCents) / total);

	return (
		<div>
			<div
				className="flex h-2 overflow-hidden rounded-full bg-line"
				role="img"
				aria-label={`${formatCents(budget.spentCents)} spent, ${formatCents(budget.committedCents)} committed, ${formatCents(budget.remainingCents)} remaining of ${formatCents(budget.budgetCents)}`}
			>
				<span className="bg-ink" style={{ width: `${spentPct}%` }} />
				<span className="bg-accent" style={{ width: `${committedPct}%` }} />
			</div>
			{compact ? (
				<p className="mt-1.5 text-xs text-muted tabular">
					<span className="font-medium text-ink">{formatCents(budget.remainingCents)}</span> left of {formatCents(budget.budgetCents)}
				</p>
			) : (
				<dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
					<BudgetFigure label="Total budget" value={budget.budgetCents} />
					<BudgetFigure label="Committed" value={budget.committedCents} swatch="bg-accent" />
					<BudgetFigure label="Spent" value={budget.spentCents} swatch="bg-ink" />
					<BudgetFigure label="Remaining" value={budget.remainingCents} strong />
				</dl>
			)}
		</div>
	);
}

function BudgetFigure({ label, value, swatch, strong = false }: { label: string; value: number; swatch?: string; strong?: boolean }) {
	return (
		<div>
			<dt className="flex items-center gap-1.5 text-xs text-muted">
				{swatch ? <span aria-hidden="true" className={`size-2 rounded-full ${swatch}`} /> : null}
				{label}
			</dt>
			<dd className={`mt-0.5 tabular ${strong ? "text-lg font-semibold" : "font-medium"}`}>{formatCents(value)}</dd>
		</div>
	);
}
