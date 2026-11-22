"use client";

import type {
	ButtonHTMLAttributes,
	InputHTMLAttributes,
	ReactNode,
	SelectHTMLAttributes,
	TextareaHTMLAttributes
} from "react";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
	return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";

const BUTTON_BASE =
	"inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
	primary: "bg-ink text-white hover:bg-ink-soft",
	secondary: "border border-line-strong bg-surface text-ink hover:bg-canvas",
	ghost: "text-ink-soft hover:bg-line/60",
	danger: "border border-danger/30 bg-surface text-danger hover:bg-danger-bg",
	accent: "bg-accent text-accent-ink hover:brightness-95"
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
	busy?: boolean;
};

export function Button({
	variant = "primary",
	busy = false,
	className,
	children,
	disabled,
	type = "button",
	...rest
}: ButtonProps) {
	return (
		<button
			type={type}
			disabled={disabled || busy}
			aria-busy={busy || undefined}
			className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], className)}
			{...rest}
		>
			{busy ? <Spinner /> : null}
			{children}
		</button>
	);
}

export function ButtonLink({
	href,
	variant = "primary",
	className,
	children
}: {
	href: string;
	variant?: ButtonVariant;
	className?: string;
	children: ReactNode;
}) {
	return (
		<Link href={href} className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], className)}>
			{children}
		</Link>
	);
}

export function Spinner({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cx(
				"inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent",
				className
			)}
		/>
	);
}

export function Card({
	children,
	className,
	as: Tag = "section"
}: {
	children: ReactNode;
	className?: string;
	as?: "section" | "div" | "article" | "li";
}) {
	return (
		<Tag className={cx("rounded-2xl border border-line bg-surface", className)}>
			{children}
		</Tag>
	);
}

export function CardHeader({
	title,
	description,
	action
}: {
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
			<div>
				<h2 className="text-[15px] font-semibold">{title}</h2>
				{description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
			</div>
			{action}
		</div>
	);
}

export function PageHeader({
	eyebrow,
	title,
	description,
	actions
}: {
	eyebrow?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<header className="mb-8 flex flex-wrap items-end justify-between gap-4">
			<div className="min-w-0">
				{eyebrow ? <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{eyebrow}</p> : null}
				<h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
				{description ? <p className="mt-2 max-w-2xl text-muted">{description}</p> : null}
			</div>
			{actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
		</header>
	);
}

export type Tone = "neutral" | "positive" | "warning" | "danger" | "info" | "accent";

const TONES: Record<Tone, string> = {
	neutral: "bg-canvas text-ink-soft border-line",
	positive: "bg-positive-bg text-positive border-positive/20",
	warning: "bg-warning-bg text-warning border-warning/20",
	danger: "bg-danger-bg text-danger border-danger/20",
	info: "bg-info-bg text-info border-info/20",
	accent: "bg-accent text-accent-ink border-transparent"
};

export function Badge({
	tone = "neutral",
	children,
	className
}: {
	tone?: Tone;
	children: ReactNode;
	className?: string;
}) {
	return (
		<span
			className={cx(
				"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
				TONES[tone],
				className
			)}
		>
			{children}
		</span>
	);
}

/** Small uppercase label above a value. */
export function Stat({
	label,
	value,
	hint,
	className
}: {
	label: ReactNode;
	value: ReactNode;
	hint?: ReactNode;
	className?: string;
}) {
	return (
		<div className={cx("min-w-0", className)}>
			<dt className="text-xs font-medium tracking-wide text-muted uppercase">{label}</dt>
			<dd className="mt-1 text-xl font-semibold tracking-tight tabular">{value}</dd>
			{hint ? <dd className="mt-0.5 text-xs text-muted">{hint}</dd> : null}
		</div>
	);
}

type FieldProps = {
	label: string;
	hint?: ReactNode;
	error?: string;
	children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
	className?: string;
};

export function Field({ label, hint, error, children, className }: FieldProps) {
	const id = useId();
	const hintId = `${id}-hint`;
	const errorId = `${id}-error`;
	const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

	return (
		<div className={cx("space-y-1.5", className)}>
			<label htmlFor={id} className="block text-sm font-medium">
				{label}
			</label>
			{children({ id, describedBy, invalid: Boolean(error) })}
			{hint ? (
				<p id={hintId} className="text-xs text-muted">
					{hint}
				</p>
			) : null}
			{error ? (
				<p id={errorId} className="text-xs font-medium text-danger">
					{error}
				</p>
			) : null}
		</div>
	);
}

const CONTROL =
	"block w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-ink focus:outline-none aria-[invalid=true]:border-danger disabled:bg-canvas";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
	return <input {...props} className={cx(CONTROL, "min-h-10", props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return <textarea rows={3} {...props} className={cx(CONTROL, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
	return <select {...props} className={cx(CONTROL, "min-h-10 pr-8", props.className)} />;
}

export function Alert({
	tone = "danger",
	title,
	children
}: {
	tone?: "danger" | "warning" | "info" | "positive";
	title?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-xl border px-4 py-3 text-sm", TONES[tone])}>
			{title ? <p className="font-medium">{title}</p> : null}
			{children ? <div className={title ? "mt-1" : undefined}>{children}</div> : null}
		</div>
	);
}

export function EmptyState({
	title,
	description,
	action
}: {
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div className="rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
			<p className="font-medium">{title}</p>
			{description ? <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p> : null}
			{action ? <div className="mt-5 flex justify-center gap-2">{action}</div> : null}
		</div>
	);
}

export function Loading({ label = "Loading…" }: { label?: string }) {
	return (
		<p className="flex items-center gap-2 py-10 text-sm text-muted" aria-live="polite">
			<Spinner /> {label}
		</p>
	);
}

export function Tabs<T extends string>({
	tabs,
	value,
	onChange,
	label
}: {
	tabs: readonly { value: T; label: ReactNode }[];
	value: T;
	onChange: (value: T) => void;
	label: string;
}) {
	return (
		<div role="tablist" aria-label={label} className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
			{tabs.map((tab) => (
				<button
					key={tab.value}
					type="button"
					role="tab"
					aria-selected={tab.value === value}
					onClick={() => onChange(tab.value)}
					className={cx(
						"-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
						tab.value === value ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
					)}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
}

/** Accessible modal built on <dialog>: focus moves to the heading, Escape closes. */
export function Dialog({
	open,
	onClose,
	title,
	description,
	children,
	footer,
	wide = false
}: {
	open: boolean;
	onClose: () => void;
	title: ReactNode;
	description?: ReactNode;
	children?: ReactNode;
	footer?: ReactNode;
	wide?: boolean;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const headingId = useId();

	useEffect(() => {
		const dialog = ref.current;

		if (dialog === null) {
			return;
		}

		if (open && !dialog.open) {
			dialog.showModal();
			dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	}, [open]);

	return (
		<dialog
			ref={ref}
			aria-labelledby={headingId}
			onClose={onClose}
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
			className={cx(
				"m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl",
				wide ? "max-w-2xl" : "max-w-md"
			)}
		>
			{open ? (
				<div className="flex max-h-[85dvh] flex-col">
					<div className="border-b border-line px-6 py-5">
						<h2 id={headingId} tabIndex={-1} data-autofocus className="text-lg font-semibold focus:outline-none">
							{title}
						</h2>
						{description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
					</div>
					{children ? <div className="overflow-y-auto px-6 py-5">{children}</div> : null}
					{footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div> : null}
				</div>
			) : null}
		</dialog>
	);
}

/** External source link that never leaks the opener. */
export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
	return (
		<a href={href} target="_blank" rel="noopener noreferrer" className={cx("underline decoration-line-strong underline-offset-4 hover:decoration-ink", className)}>
			{children}
			<span className="sr-only"> (opens in a new tab)</span>
		</a>
	);
}
