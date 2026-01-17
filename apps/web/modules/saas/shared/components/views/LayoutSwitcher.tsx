"use client";

import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { CalendarIcon, ColumnsIcon, LayoutListIcon } from "lucide-react";

type LayoutType = "table" | "calendar" | "kanban";

interface LayoutSwitcherProps {
	value: LayoutType;
	onChange: (layout: LayoutType) => void;
	availableLayouts?: LayoutType[];
	disabled?: boolean;
}

const LAYOUTS = [
	{ type: "table" as const, icon: LayoutListIcon, label: "Table view" },
	{ type: "calendar" as const, icon: CalendarIcon, label: "Calendar view" },
	{ type: "kanban" as const, icon: ColumnsIcon, label: "Board view" },
];

export function LayoutSwitcher({
	value,
	onChange,
	availableLayouts,
	disabled,
}: LayoutSwitcherProps) {
	const filteredLayouts = availableLayouts
		? LAYOUTS.filter((layout) => availableLayouts.includes(layout.type))
		: LAYOUTS;

	if (filteredLayouts.length <= 1) {
		return null;
	}

	return (
		<ToggleGroup
			type="single"
			value={value}
			onValueChange={(val) => {
				if (val) {
					onChange(val as LayoutType);
				}
			}}
			variant="outline"
			size="sm"
			className="gap-1"
			disabled={disabled}
		>
			{filteredLayouts.map((layout) => (
				<TooltipProvider key={layout.type}>
					<Tooltip>
						<TooltipTrigger asChild>
							<ToggleGroupItem
								value={layout.type}
								aria-label={layout.label}
								className={cn("size-8 p-0")}
								disabled={disabled}
							>
								<layout.icon className="size-4" />
							</ToggleGroupItem>
						</TooltipTrigger>
						<TooltipContent>
							<p>{layout.label}</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			))}
		</ToggleGroup>
	);
}
