"use client";

import { Button } from "@repo/ui/components/button";
import { PlusIcon } from "lucide-react";
import { FilterChip } from "./filter-chip";

interface CollapsibleFilterBarProps {
	filters: Array<{
		id: string;
		label: string;
		value: string | string[];
		icon?: React.ComponentType<{ className?: string }>;
	}>;
	onRemoveFilter: (id: string) => void;
	onEditFilter?: (id: string) => void;
	onAddFilter: () => void;
	onClearAll?: () => void;
}

export function CollapsibleFilterBar({
	filters,
	onRemoveFilter,
	onEditFilter,
	onAddFilter,
	onClearAll,
}: CollapsibleFilterBarProps) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			{filters.map((filter) => (
				<FilterChip
					key={filter.id}
					id={filter.id}
					label={filter.label}
					value={filter.value}
					icon={filter.icon}
					onRemove={onRemoveFilter}
					onEdit={onEditFilter}
				/>
			))}

			<Button
				variant="ghost"
				size="sm"
				onClick={onAddFilter}
				className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
			>
				<PlusIcon className="size-3.5" />
				Filter
			</Button>

			{filters.length >= 2 && onClearAll && (
				<button
					type="button"
					onClick={onClearAll}
					className="text-xs text-muted-foreground hover:text-foreground hover:underline"
				>
					Clear all
				</button>
			)}
		</div>
	);
}
