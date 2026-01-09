"use client";

import { Card, CardContent } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import { BarChart3Icon, CalendarIcon, CameraIcon, PackageIcon } from "lucide-react";
import { format } from "date-fns";

interface QuickStatsCardProps {
	createdAt: Date | string;
	bookingType: string | null;
	packageType: string | null;
	shootsCount: number;
	deliverablesCount: number;
	className?: string;
}

/**
 * Displays quick reference stats about the booking
 * Shows creation date, type info, and counts
 */
export function QuickStatsCard({
	createdAt,
	bookingType,
	packageType,
	shootsCount,
	deliverablesCount,
	className,
}: QuickStatsCardProps) {
	const formatDate = (date: Date | string) => {
		if (!date) return "-";
		return format(new Date(date), "MMM d, yyyy");
	};

	const stats = [
		{
			label: "Created",
			value: formatDate(createdAt),
			icon: CalendarIcon,
		},
		{
			label: "Booking Type",
			value: bookingType || "-",
			icon: BarChart3Icon,
		},
		{
			label: "Package",
			value: packageType || "-",
			icon: PackageIcon,
		},
		{
			label: "Shoots",
			value: shootsCount.toString(),
			icon: CameraIcon,
		},
		{
			label: "Deliverables",
			value: deliverablesCount.toString(),
			icon: PackageIcon,
		},
	];

	return (
		<Card className={cn("shadow-none", className)}>
			<CardContent className="p-4">
				<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
					<BarChart3Icon className="h-4 w-4" />
					<span>Quick Stats</span>
				</div>

				<div className="mt-3 space-y-2">
					{stats.map((stat) => (
						<div
							key={stat.label}
							className="flex items-center justify-between text-sm"
						>
							<span className="text-muted-foreground">{stat.label}</span>
							<span className="font-medium">{stat.value}</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
