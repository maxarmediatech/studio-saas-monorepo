"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
	CalendarIcon,
	CameraIcon,
	CheckSquareIcon,
	HistoryIcon,
	PackageIcon,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { recentVisitsApi } from "@saas/studio/lib/api";

interface RecentVisitsWidgetProps {
	organizationSlug: string;
}

const getEntityIcon = (type: string) => {
	switch (type) {
		case "booking":
			return <CalendarIcon className="h-4 w-4" />;
		case "shoot":
			return <CameraIcon className="h-4 w-4" />;
		case "task":
			return <CheckSquareIcon className="h-4 w-4" />;
		case "deliverable":
			return <PackageIcon className="h-4 w-4" />;
		default:
			return <HistoryIcon className="h-4 w-4" />;
	}
};

const getEntityRoute = (
	organizationSlug: string,
	type: string,
	entityId: string,
) => {
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
};

export function RecentVisitsWidget({
	organizationSlug,
}: RecentVisitsWidgetProps) {
	const { data, isLoading } = useQuery(
		recentVisitsApi.listOptions({ limit: 5 }),
	);

	const visits = data?.data ?? [];

	if (isLoading) {
		return (
			<Card className="h-full">
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base font-medium">
						<HistoryIcon className="h-4 w-4 text-muted-foreground" />
						Recent Items
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{Array.from({ length: 5 }).map((_, i) => (
						<div key={i} className="flex items-center gap-3">
							<Skeleton className="h-8 w-8 rounded-md" />
							<div className="space-y-1">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-3 w-20" />
							</div>
						</div>
					))}
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="h-full">
			<CardHeader className="flex flex-row items-center justify-between pb-3">
				<CardTitle className="flex items-center gap-2 text-base font-medium">
					<HistoryIcon className="h-4 w-4 text-muted-foreground" />
					Recent Items
				</CardTitle>
				{visits.length > 0 && (
					<Link
						href="#"
						className="text-xs text-muted-foreground hover:text-foreground hover:underline"
					>
						View all
					</Link>
				)}
			</CardHeader>
			<CardContent>
				{visits.length === 0 ? (
					<div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
						<HistoryIcon className="h-8 w-8 opacity-20" />
						<p className="text-sm">No recently visited items</p>
					</div>
				) : (
					<div className="space-y-4">
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
									className="group flex items-center justify-between gap-3 rounded-md transition-colors hover:bg-muted/50 p-2 -mx-2"
								>
									<div className="flex items-center gap-3 overflow-hidden">
										<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground group-hover:text-foreground transition-colors">
											{icon}
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<p className="truncate text-sm font-medium text-foreground">
													{visit.entityData?.name ??
														"Unknown Item"}
												</p>
												{visit.entityData?.status && (
													<Badge
														variant="outline"
														className="text-[10px] h-4 px-1 py-0"
													>
														{
															visit.entityData
																.status
														}
													</Badge>
												)}
											</div>
											<p className="truncate text-xs text-muted-foreground">
												<span className="capitalize">
													{visit.entityType}
												</span>
												{visit.entityData
													?.referenceNumber && (
													<>
														{" • "}
														<span className="font-mono">
															{
																visit.entityData
																	.referenceNumber
															}
														</span>
													</>
												)}
											</p>
										</div>
									</div>
									<div className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
										{formatDistanceToNow(
											new Date(visit.visitedAt),
											{ addSuffix: true },
										)}
									</div>
								</Link>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
