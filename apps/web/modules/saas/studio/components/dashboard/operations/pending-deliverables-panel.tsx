"use client";

import type { PendingDeliverableItem } from "@repo/api/modules/studio/schemas/dashboard";
import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { AlertTriangleIcon, PackageIcon } from "lucide-react";
import Link from "next/link";

interface PendingDeliverablesPanelProps {
	deliverables: PendingDeliverableItem[];
	organizationSlug: string;
}

export function PendingDeliverablesPanel({
	deliverables,
	organizationSlug,
}: PendingDeliverablesPanelProps) {
	const hasData = deliverables.length > 0;

	return (
		<Card className="flex flex-col">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-base">
						<PackageIcon className="size-4" />
						Pending Deliverables
					</CardTitle>
					<Link
						href={`/app/${organizationSlug}/deliverables`}
						className="text-xs text-muted-foreground hover:text-foreground"
					>
						View all
					</Link>
				</div>
			</CardHeader>
			<CardContent className="flex-1 overflow-auto">
				{!hasData ? (
					<div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
						No pending deliverables in this range
					</div>
				) : (
					<div className="space-y-3">
						{deliverables.map((deliverable) => (
							<DeliverableItem
								key={deliverable.id}
								deliverable={deliverable}
								organizationSlug={organizationSlug}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function DeliverableItem({
	deliverable,
	organizationSlug,
}: {
	deliverable: PendingDeliverableItem;
	organizationSlug: string;
}) {
	return (
		<Link
			href={`/app/${organizationSlug}/deliverables/${deliverable.id}`}
			className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<p className="truncate font-medium">
							{deliverable.name}
						</p>
						{deliverable.isOverdue && (
							<AlertTriangleIcon className="size-3.5 shrink-0 text-destructive" />
						)}
					</div>
					<p className="truncate text-xs text-muted-foreground">
						{deliverable.bookingName}
					</p>
				</div>
			</div>
			<div className="mt-2 flex flex-wrap items-center gap-2">
				{deliverable.dueDate && (
					<Badge
						variant={
							deliverable.isOverdue ? "destructive" : "outline"
						}
						className="text-xs"
					>
						{deliverable.isOverdue ? "Overdue: " : "Due: "}
						{deliverable.dueDate}
					</Badge>
				)}
				<WorkflowStatusBadge status={deliverable.workflowStatus} />
			</div>
			{deliverable.assignedCrew.length > 0 && (
				<div className="mt-2 flex flex-wrap gap-1">
					{deliverable.assignedCrew.slice(0, 2).map((crew) => (
						<Badge
							key={crew.id}
							variant="secondary"
							className="text-xs"
						>
							{crew.name}
						</Badge>
					))}
					{deliverable.assignedCrew.length > 2 && (
						<Badge variant="outline" className="text-xs">
							+{deliverable.assignedCrew.length - 2}
						</Badge>
					)}
				</div>
			)}
		</Link>
	);
}

function WorkflowStatusBadge({ status }: { status: string }) {
	const statusLabels: Record<string, string> = {
		not_started: "Not Started",
		assigned: "Assigned",
		revision_requested: "Revision",
	};

	return (
		<Badge variant="secondary" className="text-xs">
			{statusLabels[status] ?? status}
		</Badge>
	);
}
