"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { shootsApi } from "@saas/studio/lib/api";
import { getEventSideLabel } from "@saas/studio/lib/event-side";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	AlertCircleIcon,
	CameraIcon,
	ClockIcon,
	MapPinIcon,
} from "lucide-react";
import { memo } from "react";

interface ShootsTabProps {
	bookingId: string;
}

export const ShootsTab = memo(function ShootsTab({
	bookingId,
}: ShootsTabProps) {
	const {
		data: shoots,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...shootsApi.listOptions({ bookingId, limit: 50 }),
		enabled: !!bookingId,
	});

	if (isLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center gap-2 py-8 text-center">
				<AlertCircleIcon className="h-10 w-10 text-destructive/50" />
				<p className="text-sm text-destructive">
					Failed to load shoots
				</p>
				<Button variant="outline" size="sm" onClick={() => refetch()}>
					Try again
				</Button>
			</div>
		);
	}

	const shootsList = shoots?.data ?? [];

	if (shootsList.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 py-8 text-center">
				<CameraIcon className="h-10 w-10 text-muted-foreground/50" />
				<p className="text-sm text-muted-foreground">
					No shoots scheduled
				</p>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-4">
				<h3 className="text-lg font-medium">Shoots</h3>
			</div>

			<div className="space-y-3">
				{shootsList.map((shoot) => {
					const shootDate = shoot.shootDate
						? format(new Date(shoot.shootDate), "MMM d, yyyy")
						: "No date";

					const timeRange =
						shoot.startTime && shoot.endTime
							? `${format(new Date(`2000-01-01T${shoot.startTime}`), "h:mm a")} - ${format(new Date(`2000-01-01T${shoot.endTime}`), "h:mm a")}`
							: null;

					return (
						<div key={shoot.id} className="rounded-lg border p-4">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<h4 className="font-medium">
										{shoot.shootType ||
											shoot.name ||
											"Unnamed Shoot"}
									</h4>
									<Badge
										variant="outline"
										className="capitalize"
									>
										{shoot.status}
									</Badge>
									{shoot.side && (
										<Badge variant="secondary">
											{getEventSideLabel(shoot.side)}
										</Badge>
									)}
								</div>

								<div className="flex items-center gap-4 text-sm text-muted-foreground">
									<div className="flex items-center gap-1">
										<CameraIcon className="h-3.5 w-3.5" />
										<span>{shootDate}</span>
									</div>

									{timeRange && (
										<div className="flex items-center gap-1">
											<ClockIcon className="h-3.5 w-3.5" />
											<span>{timeRange}</span>
										</div>
									)}

									{shoot.venue && (
										<div className="flex items-center gap-1">
											<MapPinIcon className="h-3.5 w-3.5" />
											<span>{shoot.venue}</span>
										</div>
									)}
								</div>
								{shoot.bookingEvent && (
									<p className="text-xs text-muted-foreground">
										Linked booking event:{" "}
										{shoot.bookingEvent.eventType}
									</p>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
});
