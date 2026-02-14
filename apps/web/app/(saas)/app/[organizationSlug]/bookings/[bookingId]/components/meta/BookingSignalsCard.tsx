"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import {
	CheckCircle2Icon,
	ClipboardListIcon,
	UsersIcon,
} from "lucide-react";

type BookingSignalsCardProps = {
	leadSource?: string | null;
	coordinator?: string | null;
	contractDate?: string | null;
};

export function BookingSignalsCard({
	leadSource,
	coordinator,
	contractDate,
}: BookingSignalsCardProps) {
	return (
		<Card className="rounded-lg">
			<CardHeader>
				<CardTitle className="text-base">Booking signals</CardTitle>
				<CardDescription>Latest updates and source info.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3 text-sm">
				<div className="flex items-start gap-3">
					<div className="rounded-md border bg-muted/20 p-2">
						<ClipboardListIcon className="h-4 w-4 text-muted-foreground" />
					</div>
					<div>
						<p className="text-sm font-medium">Lead source</p>
						<p className="text-xs text-muted-foreground">
							{leadSource || "Not specified"}
						</p>
					</div>
				</div>
				<div className="flex items-start gap-3">
					<div className="rounded-md border bg-muted/20 p-2">
						<UsersIcon className="h-4 w-4 text-muted-foreground" />
					</div>
					<div>
						<p className="text-sm font-medium">Coordinator</p>
						<p className="text-xs text-muted-foreground">
							{coordinator || "Not assigned"}
						</p>
					</div>
				</div>
				<div className="flex items-start gap-3">
					<div className="rounded-md border bg-muted/20 p-2">
						<CheckCircle2Icon className="h-4 w-4 text-muted-foreground" />
					</div>
					<div>
						<p className="text-sm font-medium">Contract status</p>
						<p className="text-xs text-muted-foreground">
							{contractDate ? `Signed on ${contractDate}` : "Not signed"}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
