"use client";

import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { getPriorityVariant, getStatusVariant } from "../utils";

type BacklogCardProps = {
	status: string;
	bookingType?: string | null;
	packageType?: string | null;
	priority?: string;
	pic?: { name: string; initials?: string } | null;
	support?: { name: string; initials?: string } | null;
};

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function formatLabel(value: string | null | undefined): string {
	if (!value) return "—";
	return value
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

export function BacklogCard({
	status,
	bookingType,
	packageType,
	priority = "medium",
	pic,
	support,
}: BacklogCardProps) {
	return (
		<Card className="rounded-lg">
			<CardHeader>
				<CardTitle className="text-base">Backlog</CardTitle>
				<CardDescription>Booking metadata and ownership.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3 text-sm">
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Status</span>
					<Badge variant={getStatusVariant(status)} className="capitalize">
						{status.replace("_", " ")}
					</Badge>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Group</span>
					<span className="font-medium">{formatLabel(bookingType)}</span>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Priority</span>
					<Badge variant={getPriorityVariant(priority)} className="capitalize">
						{priority}
					</Badge>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">Label</span>
					<Badge variant="outline">{formatLabel(packageType)}</Badge>
				</div>
				{pic && (
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground">PIC</span>
						<div className="flex items-center gap-2">
							<Avatar className="h-6 w-6">
								<AvatarFallback className="text-[10px]">
									{pic.initials || getInitials(pic.name)}
								</AvatarFallback>
							</Avatar>
							<span className="text-sm font-medium">{pic.name}</span>
						</div>
					</div>
				)}
				{support && (
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground">Support</span>
						<div className="flex items-center gap-2">
							<Avatar className="h-6 w-6">
								<AvatarFallback className="text-[10px]">
									{support.initials || getInitials(support.name)}
								</AvatarFallback>
							</Avatar>
							<span className="text-sm font-medium">{support.name}</span>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
