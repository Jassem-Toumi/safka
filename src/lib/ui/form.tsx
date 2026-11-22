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
	"inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
	primary: "bg-indigo-600 text-white enabled:hover:bg-indigo-700",
	secondary:
		"border border-zinc-300 bg-white text-zinc-900 enabled:hover:bg-zinc-100",
	danger: "bg-red-600 text-white enabled:hover:bg-red-700"
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
				<p id={fieldHintId(htmlFor)} className="text-sm text-zinc-600">
					{hint}
				</p>
			) : null}
			{children}
			{error ? (
				<p
					id={fieldErrorId(htmlFor)}
					role="alert"
					className="text-sm font-medium text-red-700"
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
			className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
		>
			{children}
		</div>
	);
}
