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
				<div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="text-sm font-semibold text-muted-foreground">
						Recents
					</div>
					<Skeleton className="h-7 w-16" />
				</div>
				<div className="min-h-[250px] flex flex-col">
					{Array.from({ length: 5 }).map((_, i) => (
						<div
							key={i}
							className="flex items-start gap-3 border-b border-border/50 py-3 sm:items-center"
						>
							<Skeleton className="size-8 rounded-sm" />
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-4 w-40" />
							</div>
							<Skeleton className="ml-auto h-3 w-16" />
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="py-4">
			<div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="text-sm font-semibold text-muted-foreground">
					Recents
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="h-8 w-full justify-between gap-1 px-2 text-xs font-medium sm:h-7 sm:w-auto sm:justify-center"
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
					visits.map((visit) => {
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
								className="group flex w-full flex-col gap-2 border-b border-border/50 py-3 text-sm transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
							>
								<div className="flex w-full min-w-0 items-start gap-3 overflow-hidden sm:items-center">
									<div className="flex-shrink-0 grid place-items-center rounded-sm bg-muted size-8">
										{icon}
									</div>
									<div className="flex min-w-0 flex-1 flex-col gap-1">
										<div className="flex flex-wrap items-center gap-2">
											{visit.entityData
												?.referenceNumber && (
												<div className="whitespace-nowrap text-sm font-medium text-muted-foreground">
													{
														visit.entityData
															.referenceNumber
													}
												</div>
											)}
											<div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
												{visit.entityType}
											</div>
										</div>
										<span className="truncate text-sm font-medium sm:font-normal">
											{visit.entityData?.name ??
												"Unknown Item"}
										</span>
									</div>
								</div>
								<div className="w-full flex-shrink-0 text-left text-xs font-medium text-muted-foreground sm:w-auto sm:text-right">
									{formatDistanceToNow(
										new Date(visit.visitedAt),
										{
											addSuffix: false,
										},
									)}
								</div>
							</Link>
						);
					})
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
