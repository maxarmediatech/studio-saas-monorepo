"use client";

import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { ArrowLeft, ArrowRight } from "lucide-react";

export interface DataTableHorizontalScrollProps {
	canScrollLeft: boolean;
	canScrollRight: boolean;
	onScrollLeft: () => void;
	onScrollRight: () => void;
	className?: string;
}

/**
 * Horizontal scroll controls for data tables with many columns.
 * Provides arrow buttons for navigating through columns.
 */
export function DataTableHorizontalScroll({
	canScrollLeft,
	canScrollRight,
	onScrollLeft,
	onScrollRight,
	className,
}: DataTableHorizontalScrollProps) {
	return (
		<div className={cn("flex items-center gap-1", className)}>
			<Button
				variant="outline"
				size="icon"
				disabled={!canScrollLeft}
				className="h-7 w-7"
				onClick={onScrollLeft}
				aria-label="Scroll left"
			>
				<ArrowLeft
					className={cn(
						"h-3.5 w-3.5",
						canScrollLeft ? "text-primary" : "text-muted-foreground",
					)}
				/>
			</Button>
			<Button
				variant="outline"
				size="icon"
				disabled={!canScrollRight}
				className="h-7 w-7"
				onClick={onScrollRight}
				aria-label="Scroll right"
			>
				<ArrowRight
					className={cn(
						"h-3.5 w-3.5",
						canScrollRight ? "text-primary" : "text-muted-foreground",
					)}
				/>
			</Button>
		</div>
	);
}
