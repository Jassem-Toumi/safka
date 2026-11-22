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
	"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap ring-1 ring-inset before:size-1.5 before:rounded-full before:bg-current before:opacity-70 before:content-['']";

const TONE_CLASSES: Record<StatusTone, string> = {
	neutral: "bg-zinc-50 text-zinc-700 ring-zinc-300",
	action: "bg-indigo-50 text-indigo-800 ring-indigo-300/70",
	success: "bg-emerald-50 text-emerald-800 ring-emerald-300/70",
	warning: "bg-amber-50 text-amber-900 ring-amber-300",
	danger: "bg-red-50 text-red-800 ring-red-300/70"
};

const PAYMENT_TONES: Record<PaymentStatus, StatusTone> = {
	NONE: "neutral",
	HELD: "action",
	RELEASED: "success",
	REFUNDED: "neutral"
};

const ORIGIN_CLASSES: Record<LabelOrigin, string> = {
	PUBLIC: "bg-sky-50 text-sky-800 ring-sky-200",
	CREATOR: "bg-zinc-100 text-zinc-700 ring-zinc-300",
	SAMPLE: "bg-amber-100 text-amber-900 ring-amber-300"
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
			<span className="text-sm text-zinc-600">Simulated payment</span>
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
