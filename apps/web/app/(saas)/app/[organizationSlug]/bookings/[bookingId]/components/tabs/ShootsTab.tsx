"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useShootParams } from "@saas/studio/hooks/params";
import { shootsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	AlertCircleIcon,
	CameraIcon,
	ClockIcon,
	MapPinIcon,
	PlusIcon,
} from "lucide-react";

interface ShootsTabProps {
	bookingId: string;
}

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

function getStatusStyle(status: string) {
	switch (status) {
		case "completed":
			return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
		case "cancelled":
			return "bg-red-500/10 text-red-700 dark:text-red-400";
		default:
			return "bg-muted text-muted-foreground";
	}
}

function ShootRow({
	shoot,
	onEdit,
}: {
	shoot: Shoot;
	onEdit: (id: string) => void;
}) {
	const timeRange =
		shoot.startTime && shoot.endTime
			? `${format(new Date(`2000-01-01T${shoot.startTime}`), "h:mm a")} – ${format(new Date(`2000-01-01T${shoot.endTime}`), "h:mm a")}`
			: null;

	return (
		<button
			type="button"
			onClick={() => onEdit(shoot.id)}
			className="w-full flex items-center justify-between gap-4 py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors text-left group"
		>
			<div className="flex-1 min-w-0 space-y-1">
				<div className="font-medium truncate">
					{shoot.shootType || shoot.name || "Unnamed Shoot"}
				</div>
				<div className="flex items-center gap-3 text-sm text-muted-foreground">
					{timeRange && (
						<span className="flex items-center gap-1">
							<ClockIcon className="h-3.5 w-3.5" />
							{timeRange}
						</span>
					)}
					{shoot.venue && (
						<span className="flex items-center gap-1 truncate">
							<MapPinIcon className="h-3.5 w-3.5 shrink-0" />
							<span className="truncate">{shoot.venue}</span>
						</span>
					)}
				</div>
			</div>
			<Badge
				variant="secondary"
				className={cn(
					"shrink-0 capitalize text-xs font-medium",
					getStatusStyle(shoot.status),
				)}
			>
				{shoot.status.replace("_", " ")}
			</Badge>
		</button>
	);
}

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

	const grouped = new Map<string, Shoot[]>();
	for (const shoot of shootsList) {
		const dateKey = shoot.shootDate
			? format(new Date(shoot.shootDate), "yyyy-MM-dd")
			: "unscheduled";
		if (!grouped.has(dateKey)) {
			grouped.set(dateKey, []);
		}
		grouped.get(dateKey)?.push(shoot);
	}

	if (isLoading) {
		return (
			<div className="space-y-3">
				<div className="flex justify-end">
					<Skeleton className="h-9 w-24" />
				</div>
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-12 w-full" />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center gap-3 py-12 text-center">
				<AlertCircleIcon className="h-8 w-8 text-muted-foreground/50" />
				<p className="text-sm text-muted-foreground">
					Failed to load shoots
				</p>
				<Button variant="outline" size="sm" onClick={() => refetch()}>
					Try again
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h3 className="font-bold text-2xl mb-2">Shoots</h3>
					<p className="text-muted-foreground mb-6">
						All scheduled photo/video sessions.
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => openCreate()}
				>
					<PlusIcon className="h-4 w-4 mr-1.5" />
					Add Shoot
				</Button>
			</div>

			{shootsList.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-12 text-center">
					<CameraIcon className="h-8 w-8 text-muted-foreground/30" />
					<p className="text-sm text-muted-foreground">
						No shoots scheduled
					</p>
				</div>
			) : (
				<div className="space-y-6">
					{Array.from(grouped.entries()).map(
						([dateKey, dateGroup]) => (
							<div key={dateKey}>
								<div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
									{dateKey === "unscheduled"
										? "Unscheduled"
										: format(
												new Date(dateKey),
												"EEEE, MMM d",
											)}
								</div>
								<div className="divide-y">
									{dateGroup.map((shoot) => (
										<ShootRow
											key={shoot.id}
											shoot={shoot}
											onEdit={openEdit}
										/>
									))}
								</div>
							</div>
						),
					)}
				</div>
			)}
		</div>
	);
}
