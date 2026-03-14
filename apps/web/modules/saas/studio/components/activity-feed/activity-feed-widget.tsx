"use client";

import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
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
	ChevronDownIcon,
	CreditCardIcon,
	EditIcon,
	PackageIcon,
	PlusIcon,
	RefreshCwIcon,
	Trash2Icon,
	UserMinusIcon,
	UserPlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface ActivityFeedWidgetProps {
	organizationSlug: string;
	limit?: number;
	title?: string;
}

type FilterKey =
	| "all"
	| "booking"
	| "shoot"
	| "task"
	| "deliverable"
	| "payment";

const FILTERS: { key: FilterKey; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "booking", label: "Bookings" },
	{ key: "shoot", label: "Shoots" },
	{ key: "task", label: "Tasks" },
	{ key: "deliverable", label: "Deliverables" },
	{ key: "payment", label: "Payments" },
];

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
	const {
		action,
		entityType,
		entityName,
		field,
		oldValue,
		newValue,
		parentEntityName,
	} = activity;
	// Safely access metadata as Record<string, unknown>
	const metadata = activity.metadata as
		| Record<string, unknown>
		| null
		| undefined;
	const note = typeof metadata?.note === "string" ? metadata.note : null;

	// Format entity type for display
	const entityTypeLabel = entityType.replace(/_/g, " ");

	switch (action) {
		case "created":
			return `created ${entityTypeLabel} "${entityName}"${parentEntityName ? ` for ${parentEntityName}` : ""}`;
		case "deleted":
			return `deleted ${entityTypeLabel} "${entityName}"`;
		case "status_changed":
			return note
				? `changed ${entityName} status from "${oldValue}" to "${newValue}" — ${note}`
				: `changed ${entityName} status from "${oldValue}" to "${newValue}"`;
		case "updated":
			if (field) {
				return `updated ${field} on "${entityName}"`;
			}
			return `updated "${entityName}"`;
		case "assigned": {
			const crewName = (metadata?.crewName as string) || "crew";
			return `assigned ${crewName} to "${entityName}"`;
		}
		case "unassigned": {
			const crewName = (metadata?.crewName as string) || "crew";
			return `removed ${crewName} from "${entityName}"`;
		}
		case "payment_received":
			return `recorded ${entityName}${parentEntityName ? ` for ${parentEntityName}` : ""}`;
		case "approved":
			return `approved "${entityName}"`;
		case "marked_paid":
			return `marked "${entityName}" as paid`;
		default:
			return `${action.replace(/_/g, " ")} "${entityName}"`;
	}
}

/**
 * Get link to entity
 */
function getEntityLink(
	organizationSlug: string,
	entityType: string,
	entityId: string,
	parentEntityType?: string | null,
	parentEntityId?: string | null,
): string {
	switch (entityType) {
		case "booking":
			return `/app/${organizationSlug}/bookings/${entityId}`;
		case "shoot":
			return `/app/${organizationSlug}/shoots/${entityId}`;
		case "shoot_assignment":
			// entityId is assignment record, parentEntityId is the shoot
			return parentEntityId
				? `/app/${organizationSlug}/shoots/${parentEntityId}`
				: "#";
		case "task":
			return `/app/${organizationSlug}/tasks/${entityId}`;
		case "task_assignment":
			// entityId is assignment record, parentEntityId is the task
			return parentEntityId
				? `/app/${organizationSlug}/tasks/${parentEntityId}`
				: "#";
		case "deliverable":
			return `/app/${organizationSlug}/deliverables/${entityId}`;
		case "deliverable_assignment":
			// entityId is assignment record, parentEntityId is the deliverable
			return parentEntityId
				? `/app/${organizationSlug}/deliverables/${parentEntityId}`
				: "#";
		case "expense":
			return `/app/${organizationSlug}/expenses/${entityId}`;
		case "crew":
			return `/app/${organizationSlug}/people/${entityId}`;
		case "client":
			return `/app/${organizationSlug}/clients/${entityId}`;
		case "received_amount":
		case "payment_schedule":
			// Link to parent booking's payments tab if available
			if (parentEntityId) {
				return `/app/${organizationSlug}/bookings/${parentEntityId}`;
			}
			return "#";
		case "submission":
			// Submissions link to parent deliverable/task
			if (parentEntityId) {
				return `/app/${organizationSlug}/${parentEntityType}s/${parentEntityId}`;
			}
			return "#";
		default:
			// For unknown nested entities, prefer parent booking as safe fallback.
			if (parentEntityType === "booking" && parentEntityId) {
				return `/app/${organizationSlug}/bookings/${parentEntityId}`;
			}
			return "#";
	}
}

export function ActivityFeedWidget({
	organizationSlug,
	limit = 15,
	title = "Recent Activity",
}: ActivityFeedWidgetProps) {
	const [filter, setFilter] = useState<FilterKey>("all");

	// Build API query options with server-side filtering
	// Each filter includes related entity types (e.g., "task" includes "task_assignment")
	// Using 'as const' to preserve literal types for API type safety
	const FILTER_ENTITY_TYPES = {
		shoot: ["shoot", "shoot_assignment"],
		task: ["task", "task_assignment"],
		deliverable: ["deliverable", "deliverable_assignment", "submission"],
		payment: ["received_amount", "payment_schedule"],
	} as const;
	const queryParams =
		filter === "all"
			? { limit }
			: filter === "booking"
				? { limit, entityType: filter }
				: { limit, entityTypes: [...FILTER_ENTITY_TYPES[filter]] };

	const { data, isLoading, error } = useQuery({
		...activitiesApi.listOptions(queryParams),
		// Refetch every 30s for near-real-time updates without WebSockets
		// Also refetch when window regains focus (user comes back to tab)
		refetchInterval: 30_000,
		refetchOnWindowFocus: true,
		staleTime: 10_000, // Consider data stale after 10s
	});

	// No client-side filtering needed - server handles it
	const activities = data?.data ?? [];

	const activeFilterLabel =
		FILTERS.find((f) => f.key === filter)?.label ?? "All";

	if (isLoading) {
		return (
			<div className="py-4">
				<div className="flex items-center justify-between mb-2">
					<div className="text-sm font-semibold text-muted-foreground">
						{title}
					</div>
					<Skeleton className="h-7 w-16" />
				</div>
				<div className="min-h-[300px] flex flex-col">
					{Array.from({ length: 6 }).map((_, i) => (
						<div
							key={i}
							className="flex items-start gap-3 py-3 border-b border-border/50"
						>
							<Skeleton className="size-8 rounded-sm flex-shrink-0" />
							<div className="flex-1 space-y-1">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-3 w-full" />
							</div>
							<Skeleton className="h-3 w-16" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="py-4">
				<div className="flex items-center justify-between mb-2">
					<div className="text-sm font-semibold text-muted-foreground">
						{title}
					</div>
				</div>
				<div className="min-h-[300px] flex flex-col items-center justify-center">
					<ActivityIcon className="size-12 text-red-300/50 mb-3" />
					<p className="text-sm text-red-500">
						Failed to load activities
					</p>
					<p className="text-xs text-muted-foreground mt-1">
						Please try again later
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="py-4">
			<div className="flex items-center justify-between mb-2">
				<div className="text-sm font-semibold text-muted-foreground">
					{title}
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="h-7 px-2 text-xs font-medium gap-1"
						>
							{activeFilterLabel}
							<ChevronDownIcon className="size-3 text-muted-foreground" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{FILTERS.map((f) => (
							<DropdownMenuItem
								key={f.key}
								onClick={() => setFilter(f.key)}
								className="text-xs font-medium"
							>
								{f.label}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div className="min-h-[300px] flex flex-col">
				{activities.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16 text-center">
						<ActivityIcon className="size-12 text-muted-foreground/20 mb-3" />
						<p className="text-sm text-muted-foreground">
							No recent activity
						</p>
						<p className="text-xs text-muted-foreground/70 mt-1">
							Activities will appear here as you work
						</p>
					</div>
				) : (
					activities.map((activity) => {
						const link = getEntityLink(
							organizationSlug,
							activity.entityType,
							activity.entityId,
							activity.parentEntityType,
							activity.parentEntityId,
						);
						const entityIcon = getEntityIcon(activity.entityType);
						const actionIcon = getActionIcon(activity.action);
						const message = getActivityMessage(activity);

						return (
							<Link
								key={activity.id}
								href={link}
								className="group flex w-full items-start gap-3 py-3 text-sm border-b border-border/50 hover:bg-muted/50 transition-colors"
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
									<div className="text-sm truncate">
										{message}
									</div>
								</div>
								<div className="flex-shrink-0 font-medium text-xs text-muted-foreground whitespace-nowrap">
									{formatDistanceToNow(
										new Date(activity.createdAt),
										{ addSuffix: false },
									)}
								</div>
							</Link>
						);
					})
				)}
			</div>
		</div>
	);
}
