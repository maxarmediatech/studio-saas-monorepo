"use client";

import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import {
	ArrowRightIcon,
	CameraIcon,
	MapPinIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";

interface UpcomingShoot {
	id: string;
	title: string;
	bookingId: string;
	bookingName: string;
	shootDate: string;
	startTime: string | null;
	location: string | null;
	assignedCount: number;
}

interface UpcomingShootsProps {
	shoots: UpcomingShoot[];
	organizationSlug: string;
}

function formatShootDate(dateString: string): string {
	const date = parseISO(dateString);
	if (isToday(date)) return "Today";
	if (isTomorrow(date)) return "Tomorrow";
	return format(date, "MMM d");
}

export function UpcomingShoots({
	shoots,
	organizationSlug,
}: UpcomingShootsProps) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base font-semibold flex items-center gap-2">
						<CameraIcon className="size-4 text-sky-500" />
						Upcoming Shoots
					</CardTitle>
					<Link
						href={`/app/${organizationSlug}/shoots`}
						className="text-sm font-medium text-primary hover:underline"
					>
						View all
					</Link>
				</div>
			</CardHeader>
			<CardContent className="pb-4">
				{shoots.length === 0 ? (
					<div className="text-center py-8">
						<CameraIcon className="size-8 text-muted-foreground mx-auto mb-2" />
						<p className="text-sm text-muted-foreground">
							No upcoming shoots
						</p>
					</div>
				) : (
					<div className="space-y-2">
						{shoots.map((shoot) => {
							const isUnstaffed = shoot.assignedCount === 0;

							return (
								<Link
									key={shoot.id}
									href={`/app/${organizationSlug}/shoots/${shoot.id}`}
									className="flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-muted/50"
								>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<p className="text-sm font-medium truncate">
												{shoot.title}
											</p>
											{isUnstaffed && (
												<Badge
													variant="destructive"
													className="text-xs"
												>
													Unstaffed
												</Badge>
											)}
										</div>
										<p className="text-xs text-muted-foreground truncate">
											{shoot.bookingName}
										</p>
										<div className="flex items-center gap-3 mt-1">
											{shoot.location && (
												<span className="text-xs text-muted-foreground flex items-center gap-1">
													<MapPinIcon className="size-3" />
													{shoot.location}
												</span>
											)}
											<span
												className={cn(
													"text-xs flex items-center gap-1",
													isUnstaffed
														? "text-destructive"
														: "text-muted-foreground",
												)}
											>
												<UsersIcon className="size-3" />
												{shoot.assignedCount} assigned
											</span>
										</div>
									</div>
									<div className="flex items-center gap-2 flex-shrink-0">
										<div className="text-right">
											<p className="text-sm font-medium">
												{formatShootDate(
													shoot.shootDate,
												)}
											</p>
											{shoot.startTime && (
												<p className="text-xs text-muted-foreground">
													{shoot.startTime}
												</p>
											)}
										</div>
										<ArrowRightIcon className="size-4 text-muted-foreground" />
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
