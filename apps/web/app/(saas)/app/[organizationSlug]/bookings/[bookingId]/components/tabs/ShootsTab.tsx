"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Progress } from "@repo/ui/components/progress";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	CustomTabsContent,
	CustomTabsList,
	CustomTabsTrigger,
	Tabs,
} from "@repo/ui/components/tabs";
import { useShootParams } from "@saas/studio/hooks/params";
import { shootsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format, isPast, isToday } from "date-fns";
import {
	AlertCircleIcon,
	CalendarIcon,
	CameraIcon,
	ClockIcon,
	MapPinIcon,
	PencilIcon,
	PlusIcon,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface ShootsTabProps {
	bookingId: string;
}

// ============================================================================
// Types & Utilities
// ============================================================================

type Shoot = {
	id: string;
	name?: string | null;
	shootType?: string | null;
	shootDate?: string | null;
	startTime?: string | null;
	endTime?: string | null;
	venue?: string | null;
	status: string;
};

function groupShootsByDate(shoots: Shoot[]) {
	const grouped = new Map<string, Shoot[]>();

	for (const shoot of shoots) {
		const dateKey = shoot.shootDate
			? format(new Date(shoot.shootDate), "yyyy-MM-dd")
			: "no-date";

		if (!grouped.has(dateKey)) {
			grouped.set(dateKey, []);
		}
		grouped.get(dateKey)?.push(shoot);
	}

	return grouped;
}

function isShootUpcoming(shoot: Shoot) {
	if (shoot.status === "completed" || shoot.status === "cancelled") {
		return false;
	}
	if (!shoot.shootDate) return true; // No date = upcoming
	const date = new Date(shoot.shootDate);
	return !isPast(date) || isToday(date);
}

// ============================================================================
// Sub-Components
// ============================================================================

function ShootCard({
	shoot,
	onEdit,
}: {
	shoot: Shoot;
	onEdit: (id: string) => void;
}) {
	const shootDate = shoot.shootDate
		? format(new Date(shoot.shootDate), "MMM d, yyyy")
		: "No date";

	const timeRange =
		shoot.startTime && shoot.endTime
			? `${format(new Date(`2000-01-01T${shoot.startTime}`), "h:mm a")} - ${format(new Date(`2000-01-01T${shoot.endTime}`), "h:mm a")}`
			: null;

	return (
		<div className="flex items-center justify-between rounded-lg border bg-background p-3 hover:bg-muted/50 transition-colors">
			<div className="flex-1 space-y-1 min-w-0">
				<div className="flex items-center gap-2 flex-wrap">
					<h4 className="font-medium truncate">
						{shoot.shootType || shoot.name || "Unnamed Shoot"}
					</h4>
					<Badge variant="outline" className="capitalize text-xs">
						{shoot.status.replace("_", " ")}
					</Badge>
				</div>

				<div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
					<div className="flex items-center gap-1">
						<CalendarIcon className="h-3 w-3" />
						<span>{shootDate}</span>
					</div>

					{timeRange && (
						<div className="flex items-center gap-1">
							<ClockIcon className="h-3 w-3" />
							<span>{timeRange}</span>
						</div>
					)}

					{shoot.venue && (
						<div className="flex items-center gap-1">
							<MapPinIcon className="h-3 w-3" />
							<span className="truncate max-w-[150px]">{shoot.venue}</span>
						</div>
					)}
				</div>
			</div>

			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8 shrink-0"
				onClick={() => onEdit(shoot.id)}
				aria-label={`Edit ${shoot.shootType || shoot.name || "shoot"}`}
			>
				<PencilIcon className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}

function ShootsList({
	shoots,
	onEdit,
	onCreate,
	emptyMessage,
}: {
	shoots: Shoot[];
	onEdit: (id: string) => void;
	onCreate: () => void;
	emptyMessage: string;
}) {
	if (shoots.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 py-8 text-center">
				<CameraIcon className="h-8 w-8 text-muted-foreground/50" />
				<p className="text-sm text-muted-foreground">{emptyMessage}</p>
				<Button variant="outline" size="sm" onClick={onCreate}>
					<PlusIcon className="h-4 w-4 mr-2" />
					Add Shoot
				</Button>
			</div>
		);
	}

	// Group by date
	const grouped = groupShootsByDate(shoots);

	return (
		<div className="space-y-6">
			{Array.from(grouped.entries()).map(([dateKey, dateGroup]) => (
				<div key={dateKey} className="space-y-3">
					<h4 className="text-sm font-medium text-muted-foreground">
						{dateKey === "no-date"
							? "Unscheduled"
							: format(new Date(dateKey), "MMMM d, yyyy")}
					</h4>
					<div className="space-y-2">
						{dateGroup.map((shoot) => (
							<ShootCard key={shoot.id} shoot={shoot} onEdit={onEdit} />
						))}
					</div>
				</div>
			))}
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function ShootsTab({ bookingId }: ShootsTabProps) {
	const { openCreate, openEdit } = useShootParams();

	const {
		data: shoots,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...shootsApi.listOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const shootsList = shoots?.data ?? [];
	const upcomingShoots = shootsList.filter(isShootUpcoming);
	const completedShoots = shootsList.filter((s) => !isShootUpcoming(s));

	const completedCount = shootsList.filter(
		(s) => s.status === "completed",
	).length;
	const progressPercentage =
		shootsList.length > 0 ? (completedCount / shootsList.length) * 100 : 0;

	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center gap-2 py-8 text-center">
				<AlertCircleIcon className="h-8 w-8 text-destructive/50" />
				<p className="text-sm text-destructive">Failed to load shoots</p>
				<Button variant="outline" size="sm" onClick={() => refetch()}>
					Try again
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Progress Card */}
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardTitle className="text-base flex items-center gap-2">
							<CameraIcon className="h-4 w-4" />
							Shoots
							<Badge variant="secondary" className="text-xs">
								{shootsList.length}
							</Badge>
						</CardTitle>
						<Button
							variant="outline"
							size="sm"
							onClick={() => openCreate()}
						>
							<PlusIcon className="h-4 w-4 mr-1" />
							Add Shoot
						</Button>
					</div>
				</CardHeader>
				{shootsList.length > 0 && (
					<CardContent className="pt-0 pb-4">
						<div className="space-y-2">
							<Progress value={progressPercentage} className="h-2" />
							<p className="text-xs text-muted-foreground">
								{completedCount} of {shootsList.length} completed
							</p>
						</div>
					</CardContent>
				)}
			</Card>

			{/* Sub-tabs for Upcoming/Completed */}
			<Tabs defaultValue="upcoming" className="space-y-4">
				<CustomTabsList>
					<CustomTabsTrigger value="upcoming">
						Upcoming ({upcomingShoots.length})
					</CustomTabsTrigger>
					<CustomTabsTrigger value="completed">
						Completed ({completedShoots.length})
					</CustomTabsTrigger>
				</CustomTabsList>

				<CustomTabsContent value="upcoming">
					<ShootsList
						shoots={upcomingShoots}
						onEdit={openEdit}
						onCreate={openCreate}
						emptyMessage="No upcoming shoots scheduled"
					/>
				</CustomTabsContent>

				<CustomTabsContent value="completed">
					<ShootsList
						shoots={completedShoots}
						onEdit={openEdit}
						onCreate={openCreate}
						emptyMessage="No completed shoots yet"
					/>
				</CustomTabsContent>
			</Tabs>
		</div>
	);
}
