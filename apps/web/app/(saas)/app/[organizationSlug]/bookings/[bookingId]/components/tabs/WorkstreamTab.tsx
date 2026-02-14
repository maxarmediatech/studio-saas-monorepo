"use client";

import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Separator } from "@repo/ui/components/separator";
import { getStatusVariant } from "../utils";

interface WorkstreamTabProps {
	bookingId: string;
}

type WorkstreamItem = {
	title: string;
	status: "pending" | "in_progress" | "completed";
	owner: string;
	dueDate: string;
};

type Workstream = {
	title: string;
	progress: string;
	items: WorkstreamItem[];
};

// Placeholder workstreams - will be populated from API in future
const defaultWorkstreams: Workstream[] = [
	{
		title: "Client alignment",
		progress: "0 of 3",
		items: [
			{
				title: "Confirm story references",
				status: "pending",
				owner: "Coordinator",
				dueDate: "TBD",
			},
			{
				title: "Finalize shot list",
				status: "pending",
				owner: "Client",
				dueDate: "TBD",
			},
			{
				title: "Sign coverage schedule",
				status: "pending",
				owner: "Planner",
				dueDate: "TBD",
			},
		],
	},
	{
		title: "Production readiness",
		progress: "0 of 3",
		items: [
			{
				title: "Confirm crew assignments",
				status: "pending",
				owner: "Operations",
				dueDate: "TBD",
			},
			{
				title: "Lock equipment list",
				status: "pending",
				owner: "Lead",
				dueDate: "TBD",
			},
			{
				title: "Share venue details",
				status: "pending",
				owner: "Planner",
				dueDate: "TBD",
			},
		],
	},
];

function WorkstreamCard({ stream }: { stream: Workstream }) {
	return (
		<Card className="rounded-lg">
			<CardHeader className="space-y-1">
				<CardTitle className="text-base">{stream.title}</CardTitle>
				<CardDescription>{stream.progress} completed</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{stream.items.map((item, index) => (
					<div key={item.title}>
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-sm font-medium">{item.title}</p>
								<p className="text-xs text-muted-foreground">
									{item.owner} - due {item.dueDate}
								</p>
							</div>
							<Badge variant={getStatusVariant(item.status)}>
								{item.status.replace("_", " ")}
							</Badge>
						</div>
						{index < stream.items.length - 1 && <Separator className="my-3" />}
					</div>
				))}
			</CardContent>
		</Card>
	);
}

export function WorkstreamTab({ bookingId: _bookingId }: WorkstreamTabProps) {
	// In future, fetch workstreams from API based on bookingId

	return (
		<div className="space-y-6">
			<div>
				<h3 className="font-bold text-2xl mb-2">Workstreams</h3>
				<p className="text-muted-foreground mb-6">
					Track progress across different workstreams.
				</p>
			</div>

			{defaultWorkstreams.map((stream) => (
				<WorkstreamCard key={stream.title} stream={stream} />
			))}
		</div>
	);
}
