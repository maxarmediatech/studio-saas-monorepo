"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Progress } from "@repo/ui/components/progress";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useDeliverableParams } from "@saas/studio/hooks/params";
import { deliverablesApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	AlertCircleIcon,
	CalendarIcon,
	PackageIcon,
	PencilIcon,
	PlusIcon,
} from "lucide-react";

interface DeliverablesCardProps {
	bookingId: string;
	className?: string;
}

const getStatusVariant = (
	status: string,
): "default" | "secondary" | "destructive" | "outline" => {
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
};

const getPriorityVariant = (
	priority: string,
): "default" | "secondary" | "destructive" | "outline" => {
	switch (priority) {
		case "high":
			return "destructive";
		case "medium":
			return "secondary";
		case "low":
			return "outline";
		default:
			return "default";
	}
};

/**
 * Displays deliverables for a booking in a card format
 * Shows progress indicator and list of deliverables with status
 */
export function DeliverablesCard({ bookingId, className }: DeliverablesCardProps) {
	const { openCreate, openEdit } = useDeliverableParams();

	const {
		data: deliverables,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...deliverablesApi.listOptions({ bookingId, limit: 50 }),
		enabled: !!bookingId,
	});

	const items = deliverables?.data ?? [];
	const count = items.length;

	// Calculate completion
	const completedCount = items.filter(
		(d) => d.status === "completed",
	).length;
	const progressPercentage =
		count > 0 ? (completedCount / count) * 100 : 0;

	return (
		<Card className={cn("shadow-none", className)}>
			<CardContent className="p-0">
				{/* Header */}
				<div className="flex items-center justify-between p-4 pb-3 border-b">
					<div className="flex items-center gap-2">
						<PackageIcon className="h-4 w-4 text-muted-foreground" />
						<h3 className="text-sm font-medium">Deliverables</h3>
						<Badge variant="secondary" className="text-xs">
							{count}
						</Badge>
					</div>
					<Button
						variant="ghost"
						size="sm"
						className="h-7"
						onClick={() => openCreate()}
					>
						<PlusIcon className="h-3 w-3 mr-1" />
						Add
					</Button>
				</div>

				{/* Progress indicator */}
				{count > 0 && (
					<div className="px-4 pt-3 space-y-1.5">
						<Progress value={progressPercentage} className="h-1.5" />
						<p className="text-xs text-muted-foreground">
							{completedCount} of {count} complete
						</p>
					</div>
				)}

				{/* Content */}
				<div className="p-4 pt-3">
					{isLoading ? (
						<div className="space-y-3">
							<Skeleton className="h-20 w-full" />
							<Skeleton className="h-20 w-full" />
						</div>
					) : isError ? (
						<div className="flex flex-col items-center gap-2 py-6 text-center">
							<AlertCircleIcon className="h-8 w-8 text-destructive/50" />
							<p className="text-sm text-destructive">
								Failed to load deliverables
							</p>
							<Button variant="outline" size="sm" onClick={() => refetch()}>
								Try again
							</Button>
						</div>
					) : items.length === 0 ? (
						<div className="flex flex-col items-center gap-2 py-6 text-center">
							<PackageIcon className="h-8 w-8 text-muted-foreground/50" />
							<p className="text-sm text-muted-foreground">
								No deliverables added
							</p>
							<Button
								variant="outline"
								size="sm"
								onClick={() => openCreate()}
							>
								<PlusIcon className="h-4 w-4 mr-2" />
								Add Deliverable
							</Button>
						</div>
					) : (
						<div className="space-y-3">
							{items.map((deliverable) => (
								<div
									key={deliverable.id}
									className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3 hover:bg-muted/50 transition-colors"
								>
									<div className="flex-1 space-y-1.5 min-w-0">
										<h4 className="font-medium truncate">
											{deliverable.name}
										</h4>

										<div className="flex items-center gap-1.5 flex-wrap">
											{deliverable.deliverableType && (
												<Badge
													variant="outline"
													className="text-xs"
												>
													{deliverable.deliverableType}
												</Badge>
											)}

											<Badge
												variant={getStatusVariant(deliverable.status)}
												className="text-xs capitalize"
											>
												{deliverable.status.replace("_", " ")}
											</Badge>

											{deliverable.priority && (
												<Badge
													variant={getPriorityVariant(
														deliverable.priority,
													)}
													className="text-xs capitalize"
												>
													{deliverable.priority}
												</Badge>
											)}
										</div>

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

										{deliverable.description && (
											<p className="text-xs text-muted-foreground line-clamp-1">
												{deliverable.description}
											</p>
										)}
									</div>

									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 shrink-0"
										onClick={() => openEdit(deliverable.id)}
										aria-label={`Edit ${deliverable.name}`}
									>
										<PencilIcon className="h-3.5 w-3.5" />
									</Button>
								</div>
							))}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
