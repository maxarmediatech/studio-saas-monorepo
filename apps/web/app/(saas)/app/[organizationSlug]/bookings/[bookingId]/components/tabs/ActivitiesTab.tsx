"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { activitiesApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
	ActivityIcon,
	CalendarIcon,
	CameraIcon,
	CheckCircle2Icon,
	CheckSquareIcon,
	CreditCardIcon,
	EditIcon,
	PackageIcon,
	PlusIcon,
	RefreshCwIcon,
	Trash2Icon,
	UserMinusIcon,
	UserPlusIcon,
} from "lucide-react";

interface ActivitiesTabProps {
	bookingId: string;
}

/**
 * Get icon based on entity type
 */
function getEntityIcon(entityType: string) {
	switch (entityType) {
		case "booking":
			return <CalendarIcon className="size-4" />;
		case "shoot":
		case "shoot_assignment":
			return <CameraIcon className="size-4" />;
		case "task":
		case "task_assignment":
			return <CheckSquareIcon className="size-4" />;
		case "deliverable":
		case "deliverable_assignment":
		case "submission":
			return <PackageIcon className="size-4" />;
		case "received_amount":
		case "payment_schedule":
			return <CreditCardIcon className="size-4" />;
		default:
			return <ActivityIcon className="size-4" />;
	}
}

/**
 * Get icon based on action type
 */
function getActionIcon(action: string) {
	switch (action) {
		case "created":
			return <PlusIcon className="size-3.5 text-green-500" />;
		case "updated":
			return <EditIcon className="size-3.5 text-blue-500" />;
		case "deleted":
			return <Trash2Icon className="size-3.5 text-red-500" />;
		case "status_changed":
		case "assignment_progress_changed":
			return <RefreshCwIcon className="size-3.5 text-orange-500" />;
		case "assigned":
			return <UserPlusIcon className="size-3.5 text-purple-500" />;
		case "unassigned":
			return <UserMinusIcon className="size-3.5 text-gray-500" />;
		case "payment_received":
			return <CreditCardIcon className="size-3.5 text-green-500" />;
		case "approved":
		case "marked_paid":
			return <CheckCircle2Icon className="size-3.5 text-green-500" />;
		default:
			return <ActivityIcon className="size-3.5 text-muted-foreground" />;
	}
}

/**
 * Generate human-readable activity message
 */
function getActivityMessage(activity: {
	action: string;
	entityType: string;
	entityName: string;
	field?: string | null;
	oldValue?: string | null;
	newValue?: string | null;
	parentEntityName?: string | null;
	metadata?: unknown;
}): string {
	const { action, entityType, entityName, field, oldValue, newValue } = activity;
	const metadata = activity.metadata as Record<string, unknown> | null | undefined;

	// Format entity type for display
	const entityTypeLabel = entityType.replace(/_/g, " ");

	switch (action) {
		case "created":
			return `Created ${entityTypeLabel} "${entityName}"`;
		case "deleted":
			return `Deleted ${entityTypeLabel} "${entityName}"`;
		case "status_changed":
			return `Changed status from "${oldValue}" to "${newValue}"`;
		case "assignment_progress_changed":
			return `Changed assignment progress from "${oldValue}" to "${newValue}"`;
		case "updated":
			if (field) {
				return `Updated ${field.replace(/_/g, " ")}`;
			}
			return `Updated "${entityName}"`;
		case "assigned": {
			const crewName = (metadata?.crewName as string) || "crew";
			return `Assigned ${crewName} to "${entityName}"`;
		}
		case "unassigned": {
			const crewName = (metadata?.crewName as string) || "crew";
			return `Removed ${crewName} from "${entityName}"`;
		}
		case "payment_received":
			return `Recorded payment ${entityName}`;
		case "approved":
			return `Approved "${entityName}"`;
		case "marked_paid":
			return `Marked "${entityName}" as paid`;
		case "submitted":
			return `Submitted "${entityName}"`;
		case "revision_requested":
			return `Requested revision for "${entityName}"`;
		case "rejected":
			return `Rejected "${entityName}"`;
		default:
			return `${action.replace(/_/g, " ")} "${entityName}"`;
	}
}

export function ActivitiesTab({ bookingId }: ActivitiesTabProps) {
	// Query activities for this booking and all its child entities
	// Using parentEntityId to get all nested activities (shoots, tasks, deliverables, payments)
	const { data, isLoading, error } = useQuery({
		...activitiesApi.listOptions({
			parentEntityId: bookingId,
			parentEntityType: "booking",
			limit: 50,
		}),
		refetchInterval: 30_000,
		refetchOnWindowFocus: true,
		staleTime: 10_000,
	});

	// Also fetch direct booking activities (when booking itself is the entity)
	const { data: directBookingData } = useQuery({
		...activitiesApi.listOptions({
			entityType: "booking",
			entityId: bookingId,
			limit: 20,
		}),
		refetchInterval: 30_000,
		refetchOnWindowFocus: true,
		staleTime: 10_000,
	});

	// Merge and sort activities by createdAt (most recent first)
	const childActivities = data?.data ?? [];
	const directActivities = directBookingData?.data ?? [];

	// Combine and deduplicate by id, then sort by date
	const activityMap = new Map<string, typeof childActivities[0]>();
	for (const activity of [...childActivities, ...directActivities]) {
		activityMap.set(activity.id, activity);
	}
	const activities = Array.from(activityMap.values()).sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	);

	if (isLoading) {
		return (
			<Card className="rounded-lg">
				<CardHeader>
					<CardTitle className="text-base">Activity</CardTitle>
					<CardDescription>
						Recent changes and updates to this booking.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Array.from({ length: 6 }).map((_, i) => (
							<div
								key={i}
								className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0"
							>
								<Skeleton className="size-8 rounded-sm flex-shrink-0" />
								<div className="flex-1 space-y-1.5">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-3 w-full max-w-xs" />
								</div>
								<Skeleton className="h-3 w-16" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card className="rounded-lg">
				<CardHeader>
					<CardTitle className="text-base">Activity</CardTitle>
					<CardDescription>
						Recent changes and updates to this booking.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<ActivityIcon className="size-12 text-red-300/50 mb-3" />
						<p className="text-sm text-red-500">Failed to load activities</p>
						<p className="text-xs text-muted-foreground mt-1">
							Please try again later
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="rounded-lg">
			<CardHeader>
				<CardTitle className="text-base">Activity</CardTitle>
				<CardDescription>
					Recent changes and updates to this booking.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{activities.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<ActivityIcon className="size-12 text-muted-foreground/20 mb-3" />
						<p className="text-sm text-muted-foreground">
							No activity recorded yet
						</p>
						<p className="text-xs text-muted-foreground/70 mt-1">
							Activities will appear here as changes are made
						</p>
					</div>
				) : (
					<div className="space-y-0">
						{activities.map((activity) => {
							const entityIcon = getEntityIcon(activity.entityType);
							const actionIcon = getActionIcon(activity.action);
							const message = getActivityMessage(activity);

							return (
								<div
									key={activity.id}
									className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0"
								>
									<div className="flex-shrink-0 relative">
										<div className="grid place-items-center rounded-sm bg-muted size-8 text-muted-foreground">
											{entityIcon}
										</div>
										<div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
											{actionIcon}
										</div>
									</div>
									<div className="flex-1 min-w-0">
										<div className="font-medium text-xs text-muted-foreground">
											{activity.actorName}
										</div>
										<div className="text-sm">
											{message}
										</div>
										{activity.field && activity.oldValue && activity.newValue && activity.action === "updated" && (
											<div className="text-xs text-muted-foreground mt-0.5">
												<span className="line-through">{activity.oldValue}</span>
												{" → "}
												<span className="font-medium">{activity.newValue}</span>
											</div>
										)}
									</div>
									<div className="flex-shrink-0 font-medium text-xs text-muted-foreground whitespace-nowrap">
										{formatDistanceToNow(
											new Date(activity.createdAt),
											{ addSuffix: false },
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
