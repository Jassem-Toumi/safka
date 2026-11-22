import type { ButtonHTMLAttributes, ReactNode } from "react";

type FieldProps = {
	label: string;
	htmlFor: string;
	error?: string | null;
	hint?: string;
	children: ReactNode;
};

type ButtonVariant = "primary" | "secondary" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
	busy?: boolean;
	/** Text while busy; defaults to the button's own text followed by "…". */
	busyLabel?: string;
};

type ErrorNoteProps = {
	children?: ReactNode;
};

const BUTTON_BASE =
	"inline-flex min-h-11 sm:min-h-9 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
	primary: "bg-accent text-accent-fg enabled:hover:bg-accent-hover",
	secondary:
		"border border-border-strong bg-surface text-fg enabled:hover:bg-surface-2",
	danger: "bg-danger-solid text-white enabled:hover:bg-danger-solid-hover"
};

export function fieldHintId(htmlFor: string): string {
	return `${htmlFor}-hint`;
}

export function fieldErrorId(htmlFor: string): string {
	return `${htmlFor}-error`;
}

/** The `aria-describedby` value a control inside `Field` should carry. */
export function fieldDescribedBy(
	htmlFor: string,
	{ hint, error }: { hint?: string; error?: string | null }
): string | undefined {
	const ids: string[] = [];

	if (hint) {
		ids.push(fieldHintId(htmlFor));
	}

	if (error) {
		ids.push(fieldErrorId(htmlFor));
	}

	return ids.length > 0 ? ids.join(" ") : undefined;
}

/**
 * Label, optional hint and inline error around one control. Field can't reach
 * into `children`, so give the control `id={htmlFor}` and
 * `aria-describedby={fieldDescribedBy(htmlFor, { hint, error })}` (plus
 * `aria-invalid` when there is an error) so screen readers announce both.
 */
export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
	return (
		<div className="space-y-1">
			<label htmlFor={htmlFor} className="block text-sm font-medium">
				{label}
			</label>
			{hint ? (
				<p id={fieldHintId(htmlFor)} className="text-sm text-fg-muted">
					{hint}
				</p>
			) : null}
			{children}
			{error ? (
				<p
					id={fieldErrorId(htmlFor)}
					role="alert"
					className="text-sm font-medium text-danger"
				>
					{error}
				</p>
			) : null}
		</div>
	);
}

/** Defaults to `type="button"`; pass `type="submit"` inside forms. */
export function Button({
	variant = "primary",
	busy = false,
	busyLabel,
	disabled,
	className,
	type = "button",
	children,
	...buttonProps
}: ButtonProps) {
	const classes = [BUTTON_BASE, BUTTON_VARIANTS[variant], className]
		.filter(Boolean)
		.join(" ");

	return (
		<button
			{...buttonProps}
			type={type}
			disabled={disabled || busy}
			aria-busy={busy || undefined}
			className={classes}
		>
			{busy ? (busyLabel ?? <>{children}…</>) : children}
		</button>
	);
}

export function ErrorNote({ children }: ErrorNoteProps) {
	if (
		children === null ||
		children === undefined ||
		children === false ||
		children === ""
	) {
		return null;
	}

	return (
		<div
			role="alert"
			className="rounded-md border border-danger-line bg-danger-soft p-3 text-sm text-danger"
		>
			{children}
		</div>
	);
}
