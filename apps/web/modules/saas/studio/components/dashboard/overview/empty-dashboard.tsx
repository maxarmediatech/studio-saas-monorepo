"use client";

import { Card, CardContent } from "@repo/ui/components/card";
import {
	CalendarPlusIcon,
	CameraIcon,
	LayoutDashboardIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";

interface EmptyDashboardProps {
	organizationSlug: string;
}

export function EmptyDashboard({ organizationSlug }: EmptyDashboardProps) {
	const quickActions = [
		{
			title: "Create a Booking",
			description: "Start by creating your first booking",
			icon: CalendarPlusIcon,
			href: `/app/${organizationSlug}/bookings/new`,
			color: "text-blue-500",
		},
		{
			title: "Add Clients",
			description: "Add your clients to the system",
			icon: UsersIcon,
			href: `/app/${organizationSlug}/clients`,
			color: "text-green-500",
		},
		{
			title: "Add Crew Members",
			description: "Set up your team",
			icon: CameraIcon,
			href: `/app/${organizationSlug}/crews`,
			color: "text-purple-500",
		},
	];

	return (
		<div className="flex flex-col items-center justify-center py-12">
			<div className="flex size-16 items-center justify-center rounded-full bg-muted mb-4">
				<LayoutDashboardIcon className="size-8 text-muted-foreground" />
			</div>
			<h2 className="text-xl font-semibold mb-2">
				Welcome to your Dashboard
			</h2>
			<p className="text-muted-foreground text-center max-w-md mb-8">
				Your dashboard will show key metrics and insights once you start
				adding bookings, shoots, and tasks.
			</p>

			<div className="grid gap-4 md:grid-cols-3 w-full max-w-2xl">
				{quickActions.map((action) => {
					const Icon = action.icon;
					return (
						<Link key={action.title} href={action.href}>
							<Card className="h-full transition-colors hover:bg-muted/50">
								<CardContent className="p-4 flex flex-col items-center text-center">
									<div className="flex size-10 items-center justify-center rounded-lg bg-muted mb-3">
										<Icon
											className={`size-5 ${action.color}`}
										/>
									</div>
									<p className="font-medium text-sm">
										{action.title}
									</p>
									<p className="text-xs text-muted-foreground mt-1">
										{action.description}
									</p>
								</CardContent>
							</Card>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
