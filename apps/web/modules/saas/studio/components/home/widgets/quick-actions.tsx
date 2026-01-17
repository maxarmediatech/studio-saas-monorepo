"use client";

import {
	CalendarIcon,
	CalendarPlusIcon,
	CameraIcon,
	CheckSquareIcon,
} from "lucide-react";
import Link from "next/link";

interface QuickActionsWidgetProps {
	organizationSlug: string;
}

const actions = [
	{
		label: "New Booking",
		icon: CalendarPlusIcon,
		href: (slug: string) => `/app/${slug}/bookings/new`,
		color: "text-blue-500",
		bgColor: "bg-blue-500/10",
	},
	{
		label: "New Shoot",
		icon: CameraIcon,
		href: (slug: string) => `/app/${slug}/shoots/new`,
		color: "text-green-500",
		bgColor: "bg-green-500/10",
	},
	{
		label: "New Task",
		icon: CheckSquareIcon,
		href: (slug: string) => `/app/${slug}/tasks/new`,
		color: "text-orange-500",
		bgColor: "bg-orange-500/10",
	},
	{
		label: "Calendar",
		icon: CalendarIcon,
		href: (slug: string) => `/app/${slug}/calendar`,
		color: "text-purple-500",
		bgColor: "bg-purple-500/10",
	},
];

export function QuickActionsWidget({
	organizationSlug,
}: QuickActionsWidgetProps) {
	return (
		<div>
			<h3 className="text-sm font-semibold text-muted-foreground mb-3">
				Quick Actions
			</h3>
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
				{actions.map((action) => {
					const Icon = action.icon;
					return (
						<Link
							key={action.label}
							href={action.href(organizationSlug)}
							className="group flex flex-col items-center gap-2 rounded-lg border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
						>
							<div
								className={`flex h-10 w-10 items-center justify-center rounded-lg ${action.bgColor} ${action.color} transition-transform group-hover:scale-110`}
							>
								<Icon className="h-5 w-5" />
							</div>
							<span className="text-xs font-medium text-center">
								{action.label}
							</span>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
