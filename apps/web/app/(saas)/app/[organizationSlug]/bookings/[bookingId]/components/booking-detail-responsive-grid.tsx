"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";
import { useBookingSidebarSafe } from "./sidebar/booking-sidebar-context";

type BookingDetailResponsiveGridProps = {
	children: ReactNode;
	className?: string;
};

export function BookingDetailResponsiveGrid({
	children,
	className,
}: BookingDetailResponsiveGridProps) {
	const sidebar = useBookingSidebarSafe();
	const isExpanded = sidebar?.isExpanded ?? false;

	return (
		<div
			className={cn(
				"grid gap-6",
				isExpanded
					? "2xl:grid-cols-[minmax(0,1fr)_320px]"
					: "lg:grid-cols-[minmax(0,1fr)_320px]",
				className,
			)}
		>
			{children}
		</div>
	);
}
