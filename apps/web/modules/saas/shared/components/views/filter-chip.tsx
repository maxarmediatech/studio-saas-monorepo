"use client";

import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";
import { XIcon } from "lucide-react";

interface FilterChipProps {
	id: string;
	field: string;
	operator?: string;
	valueText: string;
	icon?: React.ComponentType<{ className?: string }>;
	onRemove: (id: string) => void;
	onClick?: (id: string) => void;
}

export function FilterChip({
	id,
	field,
	operator = "is",
	valueText,
	icon: Icon,
	onRemove,
	onClick,
}: FilterChipProps) {
	const displayValue =
		valueText.length > 30 ? `${valueText.slice(0, 30)}...` : valueText;

	return (
		<Badge
			variant="outline"
			className={cn(
				"group h-7 gap-1.5 pr-1 pl-2 text-xs",
				onClick &&
					"cursor-pointer hover:bg-accent hover:text-accent-foreground",
			)}
			onClick={() => onClick?.(id)}
		>
			{Icon && <Icon className="size-3.5 text-muted-foreground" />}
			<span className="font-medium text-foreground">{field}</span>
			<span className="text-muted-foreground">{operator}</span>
			<span className="font-medium text-foreground">{displayValue}</span>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onRemove(id);
				}}
				className="ml-0.5 rounded-full p-0.5 opacity-60 hover:opacity-100 hover:bg-muted transition-opacity"
				aria-label={`Remove ${field} filter`}
			>
				<XIcon className="size-3" />
			</button>
		</Badge>
	);
}
