"use client";

import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { ListFilterIcon, ListFilterPlusIcon } from "lucide-react";

interface DataTableFilterToggleProps {
	isOpen: boolean;
	hasActiveFilters: boolean;
	onToggle: () => void;
	disabled?: boolean;
}

export function DataTableFilterToggle({
	isOpen,
	hasActiveFilters,
	onToggle,
	disabled,
}: DataTableFilterToggleProps) {
	return (
		<Button
			variant="outline"
			size="sm"
			className={cn(
				"h-8 w-8 p-0",
				hasActiveFilters && "border-primary bg-primary/10 text-primary",
				isOpen && "bg-muted",
			)}
			onClick={onToggle}
			disabled={disabled}
			aria-pressed={isOpen}
			aria-expanded={isOpen}
			aria-controls="datatable-filter-row"
		>
			{isOpen ? (
				<ListFilterPlusIcon className="size-4" />
			) : (
				<ListFilterIcon className="size-4" />
			)}
			{hasActiveFilters && (
				<span className="sr-only">Filters active</span>
			)}
		</Button>
	);
}
