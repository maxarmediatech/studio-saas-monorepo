import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

/**
 * Vertical stack for one logical group of fields.
 * Stack multiple sections inside a `gap-7` container.
 */
function FormSection({ className, ...props }: React.ComponentProps<"section">) {
	return (
		<section
			data-slot="form-section"
			className={cn("grid gap-4", className)}
			{...props}
		/>
	);
}

/**
 * Section heading: optional icon chip, title, dashed rule filling the
 * remaining space, and optional uppercase meta text on the right.
 */
function FormSectionHeading({
	className,
	icon: Icon,
	title,
	meta,
	...props
}: React.ComponentProps<"div"> & {
	icon?: React.ElementType;
	title: string;
	meta?: React.ReactNode;
}) {
	return (
		<div
			data-slot="form-section-heading"
			className={cn("flex min-w-0 items-center gap-3 pb-2", className)}
			{...props}
		>
			{Icon ? (
				<span className="border-border bg-background grid size-8 shrink-0 place-items-center rounded-md border">
					<Icon className="text-muted-foreground size-4" />
				</span>
			) : null}
			<h2 className="text-foreground shrink-0 text-sm font-semibold">
				{title}
			</h2>
			<span className="border-border min-w-0 flex-1 border-t border-dashed" />
			{meta ? (
				<span className="text-muted-foreground shrink-0 text-11 font-semibold tracking-[0.12em] uppercase">
					{meta}
				</span>
			) : null}
		</div>
	);
}

/**
 * Side-by-side field grid; collapses to a single column on small screens.
 * Span a field across the full row with `className="sm:col-span-2"`.
 */
function FieldRow({
	className,
	cols = 2,
	...props
}: React.ComponentProps<"div"> & {
	cols?: 2 | 3;
}) {
	return (
		<div
			data-slot="field-row"
			className={cn(
				"grid gap-3",
				cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
				className,
			)}
			{...props}
		/>
	);
}

export { FieldRow, FormSection, FormSectionHeading };
