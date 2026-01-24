"use client";

import type { UpcomingShootItem } from "@repo/api/modules/studio/schemas/dashboard";
import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import { CameraIcon, MapPinIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

interface UpcomingShootsPanelProps {
	shoots: UpcomingShootItem[];
	organizationSlug: string;
}

export function UpcomingShootsPanel({
	shoots,
	organizationSlug,
}: UpcomingShootsPanelProps) {
	const hasData = shoots.length > 0;

	return (
		<Card className="flex flex-col">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-base">
						<CameraIcon className="size-4" />
						Upcoming Shoots
					</CardTitle>
					<Link
						href={`/app/${organizationSlug}/shoots`}
						className="text-xs text-muted-foreground hover:text-foreground"
					>
						View all
					</Link>
				</div>
			</CardHeader>
			<CardContent className="flex-1 overflow-auto">
				{!hasData ? (
					<div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
						No upcoming shoots in this range
					</div>
				) : (
					<div className="space-y-3">
						{shoots.map((shoot) => (
							<ShootItem
								key={shoot.id}
								shoot={shoot}
								organizationSlug={organizationSlug}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function ShootItem({
	shoot,
	organizationSlug,
}: {
	shoot: UpcomingShootItem;
	organizationSlug: string;
}) {
	const hasNoCrew = shoot.assignedCrew.length === 0;

	return (
		<Link
			href={`/app/${organizationSlug}/shoots/${shoot.id}`}
			className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium">{shoot.title}</p>
					<p className="truncate text-xs text-muted-foreground">
						{shoot.bookingName}
					</p>
				</div>
				<Badge variant="outline" className="shrink-0 text-xs">
					{shoot.shootDate}
				</Badge>
			</div>
			<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
				{shoot.startTime && (
					<span>
						{shoot.startTime}
						{shoot.endTime && ` - ${shoot.endTime}`}
					</span>
				)}
				{shoot.location && (
					<span className="flex items-center gap-1">
						<MapPinIcon className="size-3" />
						<span className="truncate max-w-[120px]">
							{shoot.location}
						</span>
					</span>
				)}
			</div>
			<div className="mt-2">
				{hasNoCrew ? (
					<Badge variant="destructive" className="text-xs">
						<UsersIcon className="mr-1 size-3" />
						No crew assigned
					</Badge>
				) : (
					<div className="flex flex-wrap gap-1">
						{shoot.assignedCrew.slice(0, 3).map((crew) => (
							<Badge
								key={crew.id}
								variant="secondary"
								className={cn(
									"text-xs",
									crew.isLead && "bg-primary/10",
								)}
							>
								{crew.name}
								{crew.isLead && " (Lead)"}
							</Badge>
						))}
						{shoot.assignedCrew.length > 3 && (
							<Badge variant="outline" className="text-xs">
								+{shoot.assignedCrew.length - 3}
							</Badge>
						)}
					</div>
				)}
			</div>
		</Link>
	);
}
