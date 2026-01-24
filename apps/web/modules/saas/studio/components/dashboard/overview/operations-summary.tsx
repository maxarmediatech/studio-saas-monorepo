"use client";

import type { OperationsSummary as OperationsSummaryData } from "@repo/api/modules/studio/schemas/dashboard";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import {
	CameraIcon,
	CheckSquareIcon,
	InboxIcon,
	PackageIcon,
} from "lucide-react";
import Link from "next/link";

interface OperationsSummaryProps {
	operations: OperationsSummaryData;
	organizationSlug: string;
	isLoading?: boolean;
}

export function OperationsSummary({
	operations,
	organizationSlug,
	isLoading,
}: OperationsSummaryProps) {
	const cards = [
		{
			title: "Shoots",
			value: operations.shootsThisWeek,
			valueLabel: "this week",
			secondary: operations.upcomingShoots,
			secondaryLabel: "upcoming",
			icon: CameraIcon,
			href: `/app/${organizationSlug}/shoots`,
			iconBg: "bg-sky-100",
			iconColor: "text-sky-600",
		},
		{
			title: "Tasks",
			value: operations.pendingTasks,
			valueLabel: "pending",
			secondary: operations.overdueTasks,
			secondaryLabel: "overdue",
			secondaryWarning: operations.overdueTasks > 0,
			icon: CheckSquareIcon,
			href: `/app/${organizationSlug}/tasks`,
			iconBg: "bg-orange-100",
			iconColor: "text-orange-600",
		},
		{
			title: "Deliverables",
			value: operations.pendingDeliverables,
			valueLabel: "pending",
			secondary: operations.overdueDeliverables,
			secondaryLabel: "overdue",
			secondaryWarning: operations.overdueDeliverables > 0,
			icon: PackageIcon,
			href: `/app/${organizationSlug}/deliverables`,
			iconBg: "bg-indigo-100",
			iconColor: "text-indigo-600",
		},
		{
			title: "Reviews",
			value: operations.pendingSubmissions,
			valueLabel: "pending",
			icon: InboxIcon,
			href: `/app/${organizationSlug}/reviews`,
			iconBg: "bg-rose-100",
			iconColor: "text-rose-600",
		},
	];

	if (isLoading) {
		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-20 rounded-lg" />
				))}
			</div>
		);
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{cards.map((card) => {
				const Icon = card.icon;
				return (
					<Link key={card.title} href={card.href}>
						<Card className="transition-colors hover:bg-muted/50">
							<CardContent className="p-4">
								<div className="flex items-center gap-3">
									<div
										className={`rounded-lg p-2 ${card.iconBg}`}
									>
										<Icon
											className={`size-4 ${card.iconColor}`}
										/>
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-muted-foreground">
											{card.title}
										</p>
										<div className="flex items-baseline gap-2">
											<span className="text-xl font-bold">
												{card.value}
											</span>
											<span className="text-xs text-muted-foreground">
												{card.valueLabel}
											</span>
										</div>
										{card.secondary !== undefined && (
											<p
												className={cn(
													"text-xs",
													card.secondaryWarning
														? "text-destructive font-medium"
														: "text-muted-foreground",
												)}
											>
												{card.secondary}{" "}
												{card.secondaryLabel}
											</p>
										)}
									</div>
								</div>
							</CardContent>
						</Card>
					</Link>
				);
			})}
		</div>
	);
}
