"use client";

import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";
import { XIcon } from "lucide-react";

interface FilterChipProps {
	id: string;
	label: string;
	value: string | string[];
	icon?: React.ComponentType<{ className?: string }>;
	onRemove: (id: string) => void;
	onEdit?: (id: string) => void;
}

export function FilterChip({
	id,
	label,
	value,
	icon: Icon,
	onRemove,
	onEdit,
}: FilterChipProps) {
	const displayValue = Array.isArray(value)
		? `${value.length} selected`
		: value;

	return (
		<Badge
			variant="outline"
			className={cn(
				"group h-7 cursor-pointer gap-1.5 pr-1 pl-2 text-xs hover:bg-accent hover:text-accent-foreground",
			)}
			onClick={() => onEdit?.(id)}
		>
			{Icon && <Icon className="size-3.5 text-muted-foreground" />}
			<span className="font-normal text-muted-foreground">{label}:</span>
			<span className="font-medium">{displayValue}</span>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onRemove(id);
				}}
				className="ml-0.5 rounded-full p-0.5 opacity-0 ring-offset-background transition-opacity hover:bg-background group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
				aria-label={`Remove ${label} filter`}
			>
				<XIcon className="size-3" />
			</button>
		</Badge>
	);
}
