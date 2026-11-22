import type { StatusTone } from "@/lib/deals";
import type {
	DealStatus,
	LabelOrigin,
	PaymentStatus
} from "@/shared/contracts";

import { paymentLabel, statusTone } from "@/lib/deals";
import { originLabel } from "@/lib/labels";

type StatusChipProps = {
	status: DealStatus;
	label: string;
};

type PaymentChipProps = {
	status: PaymentStatus;
};

type OriginLabelProps = {
	origin: LabelOrigin;
};

const CHIP_BASE =
	"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

const TONE_CLASSES: Record<StatusTone, string> = {
	neutral: "bg-surface-2 text-fg-secondary ring-border",
	action: "bg-accent-soft text-accent-text ring-accent-line",
	success: "bg-success-soft text-success ring-success-line",
	warning: "bg-warning-soft text-warning ring-warning-line",
	danger: "bg-danger-soft text-danger ring-danger-line"
};

const PAYMENT_TONES: Record<PaymentStatus, StatusTone> = {
	NONE: "neutral",
	HELD: "action",
	RELEASED: "success",
	REFUNDED: "neutral"
};

const ORIGIN_CLASSES: Record<LabelOrigin, string> = {
	PUBLIC: "bg-info-soft text-info ring-info-line",
	CREATOR: "bg-surface-2 text-fg-secondary ring-border",
	SAMPLE: "bg-warning-soft text-warning ring-warning-line"
};

/** The label text carries the meaning; color only reinforces it. */
export function StatusChip({ status, label }: StatusChipProps) {
	return (
		<span className={`${CHIP_BASE} ${TONE_CLASSES[statusTone(status)]}`}>
			{label}
		</span>
	);
}

export function PaymentChip({ status }: PaymentChipProps) {
	return (
		<span className="inline-flex flex-wrap items-center gap-2">
			<span className="text-sm text-fg-muted">Simulated payment</span>
			<span className={`${CHIP_BASE} ${TONE_CLASSES[PAYMENT_TONES[status]]}`}>
				{paymentLabel(status)}
			</span>
		</span>
	);
}

export function OriginLabel({ origin }: OriginLabelProps) {
	return (
		<span
			className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${ORIGIN_CLASSES[origin]}`}
		>
			{originLabel(origin)}
		</span>
	);
}
