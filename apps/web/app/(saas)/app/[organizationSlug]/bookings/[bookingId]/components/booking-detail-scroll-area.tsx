"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

type BookingDetailScrollAreaProps = {
	children: ReactNode;
	className?: string;
};

export function BookingDetailScrollArea({
	children,
	className,
}: BookingDetailScrollAreaProps) {
	return (
		<div
			className={cn(
				"flex-1 min-h-0 overflow-y-auto scrollbar-thin",
				className,
			)}
		>
			{children}
		</div>
	);
}
