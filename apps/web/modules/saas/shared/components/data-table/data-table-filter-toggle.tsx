"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { ListFilterIcon, ListFilterPlusIcon } from "lucide-react";
import { useEffect } from "react";

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
	const isActive = isOpen || hasActiveFilters;

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
				e.preventDefault();
				onToggle();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onToggle]);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					className={cn(
						"inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background transition-colors",
						"hover:bg-accent hover:text-accent-foreground",
						"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
						"disabled:pointer-events-none disabled:opacity-50",
						isActive
							? "border-[1.6px] border-neutral-800 text-neutral-900"
							: "border-input text-muted-foreground",
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
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom" sideOffset={8}>
				<span>{isOpen ? "Hide filters" : "Show filters"}</span>
				<kbd className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
					⌘⇧F
				</kbd>
			</TooltipContent>
		</Tooltip>
	);
}
