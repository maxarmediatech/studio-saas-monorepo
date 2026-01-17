"use client";

import { Activity } from "react";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

interface DataTableFilterRowProps {
	id?: string;
	visible: boolean;
	hasActiveFilters: boolean;
	onClearAll?: () => void;
	onSaveView?: () => void;
	onUpdateView?: () => void;
	filterControls?: React.ReactNode[];
	showSaveView?: boolean;
	showUpdateView?: boolean;
	isUpdating?: boolean;
	className?: string;
}

export function DataTableFilterRow({
	id = "datatable-filter-row",
	visible,
	hasActiveFilters,
	onClearAll,
	onSaveView,
	onUpdateView,
	filterControls,
	showSaveView = false,
	showUpdateView = false,
	isUpdating = false,
	className,
}: DataTableFilterRowProps) {
	const showClearAll = hasActiveFilters && onClearAll;
	const showActions = showClearAll || showSaveView || showUpdateView;

	return (
		<Activity mode={visible ? "visible" : "hidden"}>
			<section
				id={id}
				aria-label="Filters"
				className={cn(
					"flex items-center gap-4 rounded-lg border border-border/50 bg-muted/30 px-4 py-3",
					"animate-in slide-in-from-top-1 duration-150",
					className,
				)}
			>
				<div className="flex flex-1 flex-wrap items-center gap-2">
					{filterControls}
				</div>

				{showActions && (
					<div className="flex items-center gap-2">
						{showClearAll && (
							<Button
								variant="ghost"
								size="sm"
								className="h-8 px-3 text-xs"
								onClick={onClearAll}
							>
								Clear all
							</Button>
						)}
						{showSaveView && (
							<Button
								variant="secondary"
								size="sm"
								className="h-8 px-3 text-xs"
								onClick={onSaveView}
							>
								Save view
							</Button>
						)}
						{showUpdateView && (
							<Button
								variant="secondary"
								size="sm"
								className="h-8 px-3 text-xs"
								onClick={onUpdateView}
								disabled={isUpdating}
							>
								{isUpdating ? "Updating..." : "Update view"}
							</Button>
						)}
					</div>
				)}
			</section>
		</Activity>
	);
}
