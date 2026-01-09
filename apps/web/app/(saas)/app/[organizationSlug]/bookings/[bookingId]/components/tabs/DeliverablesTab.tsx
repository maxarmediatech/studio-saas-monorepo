"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Progress } from "@repo/ui/components/progress";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	CustomTabsContent,
	CustomTabsList,
	CustomTabsTrigger,
	Tabs,
} from "@repo/ui/components/tabs";
import { useDeliverableParams } from "@saas/studio/hooks/params";
import { deliverablesApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	AlertCircleIcon,
	CalendarIcon,
	PackageIcon,
	PencilIcon,
	PlusIcon,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface DeliverablesTabProps {
	bookingId: string;
}

type DeliverableStatus =
	| "pending"
	| "in_progress"
	| "completed"
	| "cancelled"
	| "in_revision";

type Deliverable = {
	id: string;
	name: string;
	deliverableType?: string | null;
	status: string;
	priority?: string | null;
	dueDate?: string | null;
	description?: string | null;
};

// ============================================================================
// Utilities
// ============================================================================

const statusOrder: DeliverableStatus[] = [
	"in_progress",
	"in_revision",
	"pending",
	"completed",
	"cancelled",
];

function getStatusVariant(
	status: string,
): "default" | "secondary" | "destructive" | "outline" {
	switch (status) {
		case "pending":
			return "secondary";
		case "in_progress":
			return "default";
		case "completed":
			return "outline";
		case "in_revision":
			return "secondary";
		case "cancelled":
			return "destructive";
		default:
			return "default";
	}
}

function getPriorityVariant(
	priority: string,
): "default" | "secondary" | "destructive" | "outline" {
	switch (priority) {
		case "high":
			return "destructive";
		case "medium":
			return "secondary";
		case "low":
			return "outline";
		default:
			return "default";
	}
}

function isDelivered(status: string): boolean {
	return status === "completed";
}

function groupByStatus(deliverables: Deliverable[]): Map<string, Deliverable[]> {
	const grouped = new Map<string, Deliverable[]>();

	for (const status of statusOrder) {
		grouped.set(status, []);
	}

	for (const d of deliverables) {
		const status = d.status as DeliverableStatus;
		if (grouped.has(status)) {
			grouped.get(status)?.push(d);
		} else {
			// Unknown status - put in pending
			grouped.get("pending")?.push(d);
		}
	}

	// Remove empty groups
	for (const [key, value] of grouped.entries()) {
		if (value.length === 0) {
			grouped.delete(key);
		}
	}

	return grouped;
}

// ============================================================================
// Sub-Components
// ============================================================================

function DeliverableCard({
	deliverable,
	onEdit,
}: {
	deliverable: Deliverable;
	onEdit: (id: string) => void;
}) {
	return (
		<div className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3 hover:bg-muted/50 transition-colors">
			<div className="flex-1 space-y-1.5 min-w-0">
				<h4 className="font-medium truncate">{deliverable.name}</h4>

				<div className="flex items-center gap-1.5 flex-wrap">
					{deliverable.deliverableType && (
						<Badge variant="outline" className="text-xs">
							{deliverable.deliverableType}
						</Badge>
					)}

					<Badge
						variant={getStatusVariant(deliverable.status)}
						className="text-xs capitalize"
					>
						{deliverable.status.replace("_", " ")}
					</Badge>

					{deliverable.priority && (
						<Badge
							variant={getPriorityVariant(deliverable.priority)}
							className="text-xs capitalize"
						>
							{deliverable.priority}
						</Badge>
					)}
				</div>

				{deliverable.dueDate && (
					<div className="flex items-center gap-1 text-xs text-muted-foreground">
						<CalendarIcon className="h-3 w-3" />
						<span>
							Due: {format(new Date(deliverable.dueDate), "MMM d, yyyy")}
						</span>
					</div>
				)}

				{deliverable.description && (
					<p className="text-xs text-muted-foreground line-clamp-1">
						{deliverable.description}
					</p>
				)}
			</div>

			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8 shrink-0"
				onClick={() => onEdit(deliverable.id)}
				aria-label={`Edit ${deliverable.name}`}
			>
				<PencilIcon className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}

function DeliverablesList({
	deliverables,
	onEdit,
	onCreate,
	emptyMessage,
	showStatusGroups,
}: {
	deliverables: Deliverable[];
	onEdit: (id: string) => void;
	onCreate: () => void;
	emptyMessage: string;
	showStatusGroups?: boolean;
}) {
	if (deliverables.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 py-8 text-center">
				<PackageIcon className="h-8 w-8 text-muted-foreground/50" />
				<p className="text-sm text-muted-foreground">{emptyMessage}</p>
				<Button variant="outline" size="sm" onClick={onCreate}>
					<PlusIcon className="h-4 w-4 mr-2" />
					Add Deliverable
				</Button>
			</div>
		);
	}

	if (showStatusGroups) {
		const grouped = groupByStatus(deliverables);

		return (
			<div className="space-y-6">
				{Array.from(grouped.entries()).map(([status, items]) => (
					<div key={status} className="space-y-3">
						<h4 className="text-sm font-medium text-muted-foreground capitalize">
							{status.replace("_", " ")} ({items.length})
						</h4>
						<div className="space-y-2">
							{items.map((d) => (
								<DeliverableCard key={d.id} deliverable={d} onEdit={onEdit} />
							))}
						</div>
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{deliverables.map((d) => (
				<DeliverableCard key={d.id} deliverable={d} onEdit={onEdit} />
			))}
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function DeliverablesTab({ bookingId }: DeliverablesTabProps) {
	const { openCreate, openEdit } = useDeliverableParams();

	const {
		data: deliverables,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...deliverablesApi.listOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const items = deliverables?.data ?? [];
	const pendingItems = items.filter((d) => !isDelivered(d.status));
	const deliveredItems = items.filter((d) => isDelivered(d.status));

	const completedCount = items.filter((d) => d.status === "completed").length;
	const progressPercentage =
		items.length > 0 ? (completedCount / items.length) * 100 : 0;

	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-20 w-full" />
				<Skeleton className="h-20 w-full" />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center gap-2 py-8 text-center">
				<AlertCircleIcon className="h-8 w-8 text-destructive/50" />
				<p className="text-sm text-destructive">Failed to load deliverables</p>
				<Button variant="outline" size="sm" onClick={() => refetch()}>
					Try again
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Progress Card */}
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardTitle className="text-base flex items-center gap-2">
							<PackageIcon className="h-4 w-4" />
							Deliverables
							<Badge variant="secondary" className="text-xs">
								{items.length}
							</Badge>
						</CardTitle>
						<Button
							variant="outline"
							size="sm"
							onClick={() => openCreate()}
						>
							<PlusIcon className="h-4 w-4 mr-1" />
							Add
						</Button>
					</div>
				</CardHeader>
				{items.length > 0 && (
					<CardContent className="pt-0 pb-4">
						<div className="space-y-2">
							<Progress value={progressPercentage} className="h-2" />
							<p className="text-xs text-muted-foreground">
								{completedCount} of {items.length} delivered
							</p>
						</div>
					</CardContent>
				)}
			</Card>

			{/* Sub-tabs */}
			<Tabs defaultValue="pending" className="space-y-4">
				<CustomTabsList>
					<CustomTabsTrigger value="pending">
						Pending ({pendingItems.length})
					</CustomTabsTrigger>
					<CustomTabsTrigger value="delivered">
						Delivered ({deliveredItems.length})
					</CustomTabsTrigger>
				</CustomTabsList>

				<CustomTabsContent value="pending">
					<DeliverablesList
						deliverables={pendingItems}
						onEdit={openEdit}
						onCreate={openCreate}
						emptyMessage="No pending deliverables"
						showStatusGroups
					/>
				</CustomTabsContent>

				<CustomTabsContent value="delivered">
					<DeliverablesList
						deliverables={deliveredItems}
						onEdit={openEdit}
						onCreate={openCreate}
						emptyMessage="No delivered items yet"
					/>
				</CustomTabsContent>
			</Tabs>
		</div>
	);
}
