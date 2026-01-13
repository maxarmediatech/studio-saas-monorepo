"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useDeliverableParams } from "@saas/studio/hooks/params";
import { deliverablesApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	AlertCircleIcon,
	CalendarIcon,
	PackageIcon,
	PlusIcon,
} from "lucide-react";
import { getStatusVariant } from "../utils";

interface DeliverablesTabProps {
	bookingId: string;
}

type Deliverable = {
	id: string;
	name: string;
	status: string;
	dueDate?: string | null;
	description?: string | null;
};

const statusOrder = [
	"in_progress",
	"in_revision",
	"pending",
	"completed",
	"cancelled",
];

function DeliverableRow({
	deliverable,
	onEdit,
}: {
	deliverable: Deliverable;
	onEdit: (id: string) => void;
}) {
	const isCompleted = deliverable.status === "completed";

	return (
		<button
			type="button"
			onClick={() => onEdit(deliverable.id)}
			className="w-full flex items-center justify-between gap-4 py-3 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
		>
			<div className="flex-1 min-w-0 space-y-1">
				<div
					className={cn(
						"font-medium truncate",
						isCompleted && "text-muted-foreground line-through",
					)}
				>
					{deliverable.name}
				</div>
				{deliverable.dueDate && (
					<div className="flex items-center gap-1 text-xs text-muted-foreground">
						<CalendarIcon className="h-3 w-3" />
						Due {format(new Date(deliverable.dueDate), "MMM d")}
					</div>
				)}
			</div>
			<Badge
				variant={getStatusVariant(deliverable.status)}
				className="shrink-0 capitalize text-xs"
			>
				{deliverable.status.replace("_", " ")}
			</Badge>
		</button>
	);
}

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

	const grouped = new Map<string, Deliverable[]>();
	for (const status of statusOrder) {
		grouped.set(status, []);
	}
	for (const item of items) {
		if (grouped.has(item.status)) {
			grouped.get(item.status)?.push(item);
		} else {
			grouped.get("pending")?.push(item);
		}
	}
	for (const [key, value] of grouped.entries()) {
		if (value.length === 0) grouped.delete(key);
	}

	if (isLoading) {
		return (
			<div className="space-y-3">
				<div className="flex justify-end">
					<Skeleton className="h-9 w-32" />
				</div>
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-12 w-full" />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center gap-3 py-12 text-center">
				<AlertCircleIcon className="h-8 w-8 text-muted-foreground/50" />
				<p className="text-sm text-muted-foreground">
					Failed to load deliverables
				</p>
				<Button variant="outline" size="sm" onClick={() => refetch()}>
					Try again
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-end">
				<Button size="sm" onClick={() => openCreate()}>
					<PlusIcon className="h-4 w-4 mr-1.5" />
					Add Deliverable
				</Button>
			</div>

			{items.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-12 text-center">
					<PackageIcon className="h-8 w-8 text-muted-foreground/30" />
					<p className="text-sm text-muted-foreground">
						No deliverables
					</p>
				</div>
			) : (
				<div className="space-y-6">
					{Array.from(grouped.entries()).map(([status, group]) => (
						<div key={status}>
							<div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
								{status.replace("_", " ")} ({group.length})
							</div>
							<div className="divide-y">
								{group.map((item) => (
									<DeliverableRow
										key={item.id}
										deliverable={item}
										onEdit={openEdit}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
