"use client";

import { Card, CardContent } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import { AlertTriangleIcon, CalendarIcon, PackageIcon } from "lucide-react";

interface OperationsStatCardsProps {
	shootsThisWeek: number;
	overdueTasksCount: number;
	overdueDeliverablesCount: number;
}

export function OperationsStatCards({
	shootsThisWeek,
	overdueTasksCount,
	overdueDeliverablesCount,
}: OperationsStatCardsProps) {
	const cards = [
		{
			title: "Shoots This Week",
			value: shootsThisWeek,
			icon: CalendarIcon,
			iconBg: "bg-sky-100",
			iconColor: "text-sky-600",
		},
		{
			title: "Overdue Tasks",
			value: overdueTasksCount,
			icon: AlertTriangleIcon,
			iconBg: overdueTasksCount > 0 ? "bg-red-100" : "bg-gray-100",
			iconColor: overdueTasksCount > 0 ? "text-red-600" : "text-gray-600",
			warning: overdueTasksCount > 0,
		},
		{
			title: "Overdue Deliverables",
			value: overdueDeliverablesCount,
			icon: PackageIcon,
			iconBg: overdueDeliverablesCount > 0 ? "bg-red-100" : "bg-gray-100",
			iconColor:
				overdueDeliverablesCount > 0 ? "text-red-600" : "text-gray-600",
			warning: overdueDeliverablesCount > 0,
		},
	];

	return (
		<div className="grid gap-4 md:grid-cols-3">
			{cards.map((card) => {
				const Icon = card.icon;
				return (
					<Card key={card.title}>
						<CardContent className="p-4">
							<div className="flex items-center gap-3">
								<div
									className={cn(
										"rounded-lg p-2",
										card.iconBg,
									)}
								>
									<Icon
										className={cn("size-4", card.iconColor)}
									/>
								</div>
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										{card.title}
									</p>
									<p
										className={cn(
											"text-2xl font-bold",
											card.warning && "text-destructive",
										)}
									>
										{card.value}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
