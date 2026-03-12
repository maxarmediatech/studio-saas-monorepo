"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { PaletteIcon, TrashIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { STICKY_COLORS_LIST, type StickyColor } from "./constants";

interface StickyToolbarProps {
	color: StickyColor;
	onColorChange: (color: StickyColor) => void;
	onDelete: () => void;
	formatToolbar?: ReactNode;
	className?: string;
}

export function StickyToolbar({
	color,
	onColorChange,
	onDelete,
	formatToolbar,
	className,
}: StickyToolbarProps) {
	const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

	return (
		<div
			className={cn(
				"flex min-h-10 w-full flex-wrap items-center gap-x-3 gap-y-2",
				className,
			)}
		>
			{/* Color Picker */}
			<Popover
				open={isColorPickerOpen}
				onOpenChange={setIsColorPickerOpen}
			>
				<Tooltip>
					<TooltipTrigger asChild>
						<PopoverTrigger asChild>
							<button
								type="button"
								className="flex size-8 items-center justify-center rounded-md text-foreground/50 transition-colors hover:bg-black/5 hover:text-foreground/70"
								aria-label="Change background color"
							>
								<PaletteIcon className="size-4" />
							</button>
						</PopoverTrigger>
					</TooltipTrigger>
					<TooltipContent side="top">
						<span className="text-xs font-medium">
							Background color
						</span>
					</TooltipContent>
				</Tooltip>

				<PopoverContent
					className="w-56 p-2"
					align="start"
					side="top"
					sideOffset={8}
				>
					<div className="text-xs font-semibold text-muted-foreground mb-2">
						Background colors
					</div>
					<div className="flex flex-wrap gap-2">
						{STICKY_COLORS_LIST.map((colorOption) => {
							const isSelected = color === colorOption.key;
							return (
								<button
									key={colorOption.key}
									type="button"
									onClick={() => {
										onColorChange(
											colorOption.key as StickyColor,
										);
										setIsColorPickerOpen(false);
									}}
									className={cn(
										"size-6 rounded-md transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										isSelected &&
											"ring-2 ring-primary scale-110",
									)}
									style={{
										backgroundColor:
											colorOption.backgroundColor,
									}}
									aria-label={`Select ${colorOption.label} color`}
									title={colorOption.label}
								/>
							);
						})}
					</div>
				</PopoverContent>
			</Popover>

			{/* Format Toolbar (Bold, Italic, Todo) */}
			{formatToolbar}

			{/* Spacer to push delete to the right */}
			<div className="flex-1" />

			{/* Delete Button */}
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={onDelete}
						className="flex size-8 items-center justify-center rounded-md text-foreground/50 transition-colors hover:bg-black/5 hover:text-destructive"
						aria-label="Delete sticky note"
					>
						<TrashIcon className="size-4" />
					</button>
				</TooltipTrigger>
				<TooltipContent side="top">
					<span className="text-xs font-medium">Delete</span>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
