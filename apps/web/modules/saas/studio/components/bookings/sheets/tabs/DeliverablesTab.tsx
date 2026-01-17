"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { deliverablesApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircleIcon, CalendarIcon, PackageIcon } from "lucide-react";
import { memo } from "react";

interface DeliverablesTabProps {
	bookingId: string;
}

export const DeliverablesTab = memo(function DeliverablesTab({
	bookingId,
}: DeliverablesTabProps) {
	const {
		data: deliverables,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...deliverablesApi.listOptions({ bookingId, limit: 50 }),
		enabled: !!bookingId,
	});

	if (isLoading) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between mb-4">
					<Skeleton className="h-7 w-32" />
					<Skeleton className="h-9 w-36" />
				</div>
				{[...Array(3)].map((_, i) => (
					<Skeleton key={i} className="h-24 w-full" />
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<div>
				<div className="mb-4">
					<h3 className="text-lg font-medium">Deliverables</h3>
				</div>
				<div className="flex flex-col items-center gap-2 py-8 text-center">
					<AlertCircleIcon className="h-10 w-10 text-destructive/50" />
					<p className="text-sm text-destructive">
						Failed to load deliverables
					</p>
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
					>
						Try again
					</Button>
				</div>
			</div>
		);
	}

	const items = deliverables?.data ?? [];

	if (items.length === 0) {
		return (
			<div>
				<div className="mb-4">
					<h3 className="text-lg font-medium">Deliverables</h3>
				</div>
				<div className="flex flex-col items-center gap-2 py-8 text-center">
					<PackageIcon className="h-10 w-10 text-muted-foreground/50" />
					<p className="text-sm text-muted-foreground">
						No deliverables added
					</p>
				</div>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-4">
				<h3 className="text-lg font-medium">Deliverables</h3>
			</div>

			<div className="space-y-3">
				{items.map((deliverable) => (
					<div key={deliverable.id} className="p-4 border rounded-lg">
						<div className="space-y-2">
							<div className="flex items-start gap-2">
								<h4 className="font-medium">
									{deliverable.name}
								</h4>
							</div>

							<div className="flex items-center gap-2 flex-wrap">
								<Badge
									variant={getStatusVariant(
										deliverable.status,
									)}
									className="text-xs"
								>
									{deliverable.status}
								</Badge>

								{deliverable.dueDate && (
									<div className="flex items-center gap-1 text-xs text-muted-foreground">
										<CalendarIcon className="h-3 w-3" />
										<span>
											Due:{" "}
											{format(
												new Date(deliverable.dueDate),
												"MMM d, yyyy",
											)}
										</span>
									</div>
								)}
							</div>

							{deliverable.description && (
								<p className="text-sm text-muted-foreground line-clamp-2">
									{deliverable.description}
								</p>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
});

function getStatusVariant(
	status: string,
): "default" | "secondary" | "destructive" | "outline" {
	switch (status) {
		case "pending":
			return "secondary";
		case "in_progress":
			return "default";
		case "completed":
			return "outline";
		case "cancelled":
			return "secondary";
		default:
			return "default";
	}
}
