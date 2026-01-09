"use client";

import type { BookingMinimal } from "@repo/api/modules/studio/schemas/booking";
import { cn } from "@repo/ui/lib/utils";
import { bookingsApi } from "@saas/studio/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback } from "react";

interface BookingListItemProps {
	booking: BookingMinimal;
	isSelected: boolean;
	organizationSlug: string;
}

export function BookingListItem({
	booking,
	isSelected,
	organizationSlug,
}: BookingListItemProps) {
	const queryClient = useQueryClient();

	const prefetchBooking = useCallback(() => {
		if (isSelected) return;
		queryClient.prefetchQuery(bookingsApi.getOptions(booking.id));
	}, [queryClient, booking.id, isSelected]);

	return (
		<Link
			href={`/app/${organizationSlug}/bookings/${booking.id}`}
			onMouseEnter={prefetchBooking}
			onFocus={prefetchBooking}
			className={cn(
				"block px-3 py-3 rounded-lg transition-colors",
				"hover:bg-muted/50",
				isSelected && "bg-muted",
			)}
		>
			<div className="flex flex-col gap-1">
				<span
					className={cn(
						"text-sm font-medium truncate",
						isSelected ? "text-foreground" : "text-foreground/90",
					)}
				>
					{booking.name}
				</span>
				<span className="text-xs text-muted-foreground font-mono">
					{booking.referenceNumber}
				</span>
			</div>
		</Link>
	);
}
