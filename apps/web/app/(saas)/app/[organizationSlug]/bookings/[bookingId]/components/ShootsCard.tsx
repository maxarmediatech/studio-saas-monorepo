"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
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
	PencilIcon,
	PlusIcon,
} from "lucide-react";

interface ShootsCardProps {
	bookingId: string;
	className?: string;
}

/**
 * Displays shoots/sessions for a booking in a card format
 * Shows shoot list with date, time, venue, and status
 */
export function ShootsCard({ bookingId, className }: ShootsCardProps) {
	const { openCreate, openEdit } = useShootParams();

	const {
		data: shoots,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...shootsApi.listOptions({ bookingId, limit: 50 }),
		enabled: !!bookingId,
	});

	const shootsList = shoots?.data ?? [];
	const count = shootsList.length;

	// Calculate completion status
	const completedCount = shootsList.filter(
		(s) => s.status === "completed",
	).length;
	const isAllComplete = count > 0 && completedCount === count;

	return (
		<Card className={cn("shadow-none", className)}>
			<CardContent className="p-0">
				{/* Header */}
				<div className="flex items-center justify-between p-4 pb-3 border-b">
					<div className="flex items-center gap-2">
						<CameraIcon className="h-4 w-4 text-muted-foreground" />
						<h3 className="text-sm font-medium">Shoots</h3>
						<Badge variant="secondary" className="text-xs">
							{count}
						</Badge>
						{isAllComplete && count > 0 && (
							<Badge
								variant="outline"
								className="text-xs bg-green-50 text-green-700 border-green-200"
							>
								Complete
							</Badge>
						)}
					</div>
					<Button
						variant="ghost"
						size="sm"
						className="h-7"
						onClick={() => openCreate()}
					>
						<PlusIcon className="h-3 w-3 mr-1" />
						Add Shoot
					</Button>
				</div>

				{/* Content */}
				<div className="p-4">
					{isLoading ? (
						<div className="space-y-3">
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
						</div>
					) : isError ? (
						<div className="flex flex-col items-center gap-2 py-6 text-center">
							<AlertCircleIcon className="h-8 w-8 text-destructive/50" />
							<p className="text-sm text-destructive">Failed to load shoots</p>
							<Button variant="outline" size="sm" onClick={() => refetch()}>
								Try again
							</Button>
						</div>
					) : shootsList.length === 0 ? (
						<div className="flex flex-col items-center gap-2 py-6 text-center">
							<CameraIcon className="h-8 w-8 text-muted-foreground/50" />
							<p className="text-sm text-muted-foreground">
								No shoots scheduled
							</p>
							<Button
								variant="outline"
								size="sm"
								onClick={() => openCreate()}
							>
								<PlusIcon className="h-4 w-4 mr-2" />
								Add Shoot
							</Button>
						</div>
					) : (
						<div className="space-y-3">
							{shootsList.map((shoot) => {
								const shootDate = shoot.shootDate
									? format(new Date(shoot.shootDate), "MMM d, yyyy")
									: "No date";

								const timeRange =
									shoot.startTime && shoot.endTime
										? `${format(new Date(`2000-01-01T${shoot.startTime}`), "h:mm a")} - ${format(new Date(`2000-01-01T${shoot.endTime}`), "h:mm a")}`
										: null;

								return (
									<div
										key={shoot.id}
										className="flex items-center justify-between rounded-lg border bg-background p-3 hover:bg-muted/50 transition-colors"
									>
										<div className="flex-1 space-y-1 min-w-0">
											<div className="flex items-center gap-2 flex-wrap">
												<h4 className="font-medium truncate">
													{shoot.shootType ||
														shoot.name ||
														"Unnamed Shoot"}
												</h4>
												<Badge
													variant="outline"
													className="capitalize text-xs"
												>
													{shoot.status}
												</Badge>
											</div>

											<div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
												<div className="flex items-center gap-1">
													<CameraIcon className="h-3 w-3" />
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
														<span className="truncate max-w-[150px]">
															{shoot.venue}
														</span>
													</div>
												)}
											</div>
										</div>

										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8 shrink-0"
											onClick={() => openEdit(shoot.id)}
											aria-label={`Edit ${shoot.shootType || shoot.name || "shoot"}`}
										>
											<PencilIcon className="h-3.5 w-3.5" />
										</Button>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
