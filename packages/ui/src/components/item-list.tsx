import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import type * as React from "react";

/**
 * Card wrapper for one entry of a repeating list (line items, crew
 * assignments, package inclusions, ...).
 */
function ItemCard({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="item-card"
			className={cn(
				"bg-muted/25 grid gap-3 rounded-lg border p-3 shadow-[0_10px_28px_-24px_color-mix(in_oklch,var(--foreground)_40%,transparent)]",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * Header row for an ItemCard: title, optional meta line (e.g. computed
 * amount) and a remove button.
 */
function ItemCardHeader({
	className,
	title,
	meta,
	onRemove,
	removeLabel = "Remove item",
	...props
}: React.ComponentProps<"div"> & {
	title: React.ReactNode;
	meta?: React.ReactNode;
	onRemove?: () => void;
	removeLabel?: string;
}) {
	return (
		<div
			data-slot="item-card-header"
			className={cn("flex items-center justify-between gap-3", className)}
			{...props}
		>
			<div>
				<div className="text-sm font-semibold">{title}</div>
				{meta ? (
					<div className="text-muted-foreground text-xs">{meta}</div>
				) : null}
			</div>
			{onRemove ? (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-8"
					aria-label={removeLabel}
					onClick={onRemove}
				>
					<Trash2 className="size-4" />
				</Button>
			) : null}
		</div>
	);
}

/**
 * Full-width dashed "add entry" button placed after the list of ItemCards.
 */
function AddItemButton({
	className,
	children,
	...props
}: React.ComponentProps<typeof Button>) {
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			data-slot="add-item-button"
			className={cn(
				"text-primary h-10 w-full border-dashed text-sm font-semibold",
				className,
			)}
			{...props}
		>
			<Plus className="size-4" />
			{children ?? "Add item"}
		</Button>
	);
}

export { AddItemButton, ItemCard, ItemCardHeader };
