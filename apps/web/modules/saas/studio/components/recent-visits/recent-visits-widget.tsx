"use client";

import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import { recentVisitsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
	CalendarIcon,
	CameraIcon,
	CheckSquareIcon,
	ChevronDownIcon,
	HistoryIcon,
	PackageIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface RecentVisitsWidgetProps {
	organizationSlug: string;
}

type FilterKey = "all" | "booking" | "shoot" | "task" | "deliverable";

const FILTERS: { key: FilterKey; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "booking", label: "Bookings" },
	{ key: "shoot", label: "Shoots" },
	{ key: "task", label: "Tasks" },
	{ key: "deliverable", label: "Deliverables" },
];

function getEntityIcon(type: string) {
	switch (type) {
		case "booking":
			return <CalendarIcon className="size-4 text-muted-foreground" />;
		case "shoot":
			return <CameraIcon className="size-4 text-muted-foreground" />;
		case "task":
			return <CheckSquareIcon className="size-4 text-muted-foreground" />;
		case "deliverable":
			return <PackageIcon className="size-4 text-muted-foreground" />;
		default:
			return <HistoryIcon className="size-4 text-muted-foreground" />;
	}
}

function getEntityRoute(
	organizationSlug: string,
	type: string,
	entityId: string,
) {
	switch (type) {
		case "booking":
			return `/app/${organizationSlug}/bookings/${entityId}`;
		case "shoot":
			return `/app/${organizationSlug}/shoots/${entityId}`;
		case "task":
			return `/app/${organizationSlug}/tasks/${entityId}`;
		case "deliverable":
			return `/app/${organizationSlug}/deliverables/${entityId}`;
		default:
			return "#";
	}
}

export function RecentVisitsWidget({
	organizationSlug,
}: RecentVisitsWidgetProps) {
	const [filter, setFilter] = useState<FilterKey>("all");

	const { data, isLoading } = useQuery(
		recentVisitsApi.listOptions({ limit: 10 }),
	);

	const allVisits = data?.data ?? [];
	const visits =
		filter === "all"
			? allVisits
			: allVisits.filter((v) => v.entityType === filter);

	const activeFilterLabel =
		FILTERS.find((f) => f.key === filter)?.label ?? "All";

	if (isLoading) {
		return (
			<div className="py-4">
				<div className="flex items-center justify-between mb-2">
					<div className="text-sm font-semibold text-muted-foreground">
						Recents
					</div>
					<Skeleton className="h-7 w-16" />
				</div>
				<div className="min-h-[250px] flex flex-col">
					{Array.from({ length: 5 }).map((_, i) => (
						<div
							key={i}
							className="flex items-center gap-3 py-3 border-b border-border/50"
						>
							<Skeleton className="size-8 rounded-sm" />
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-3 w-16 ml-auto" />
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="py-4">
			<div className="flex items-center justify-between mb-2">
				<div className="text-sm font-semibold text-muted-foreground">
					Recents
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

			<div className="min-h-[250px] flex flex-col">
				{visits.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16 text-center">
						<HistoryIcon className="size-12 text-muted-foreground/20 mb-3" />
						<p className="text-sm text-muted-foreground">
							No recent items
						</p>
					</div>
				) : (
					<>
						{visits.map((visit) => {
							const route = getEntityRoute(
								organizationSlug,
								visit.entityType,
								visit.entityId,
							);
							const icon = getEntityIcon(visit.entityType);

							return (
								<Link
									key={visit.id}
									href={route}
									className="group flex w-full items-center justify-between gap-3 py-3 text-sm border-b border-border/50 hover:bg-muted/50 transition-colors"
								>
									<div className="flex items-center gap-3 overflow-hidden">
										<div className="flex-shrink-0 grid place-items-center rounded-sm bg-muted size-8">
											{icon}
										</div>
										{visit.entityData?.referenceNumber && (
											<div className="font-medium text-muted-foreground text-sm whitespace-nowrap">
												{
													visit.entityData
														.referenceNumber
												}
											</div>
										)}
										<span className="truncate text-sm">
											{visit.entityData?.name ??
												"Unknown Item"}
										</span>
									</div>
									<div className="flex-shrink-0 font-medium text-xs text-muted-foreground">
										{formatDistanceToNow(
											new Date(visit.visitedAt),
											{ addSuffix: false },
										)}
									</div>
								</Link>
							);
						})}
					</>
				)}
			</div>

			{visits.length > 0 && (
				<div className="flex justify-center py-2">
					<Link
						href={`/app/${organizationSlug}/recents`}
						className="text-sm text-primary hover:underline"
					>
						Show all
					</Link>
				</div>
			)}
		</div>
	);
}
