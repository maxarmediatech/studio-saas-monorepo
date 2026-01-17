"use client";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useDeliverableParams } from "@saas/studio/hooks/params";
import { deliverablesApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	AlertCircleIcon,
	MoreVertical,
	PackageIcon,
	PlusIcon,
} from "lucide-react";

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

const STATUS_STYLES: Record<string, string> = {
	pending: "text-gray-600 bg-gray-50 ring-gray-500/10",
	in_progress: "text-blue-700 bg-blue-50 ring-blue-600/20",
	in_revision: "text-yellow-800 bg-yellow-50 ring-yellow-600/20",
	completed: "text-green-700 bg-green-50 ring-green-600/20",
	cancelled: "text-red-700 bg-red-50 ring-red-600/20",
};

function getStatusStyle(status: string) {
	return STATUS_STYLES[status] || "text-gray-600 bg-gray-50 ring-gray-500/10";
}

function DeliverableRow({
	deliverable,
	onEdit,
}: {
	deliverable: Deliverable;
	onEdit: (id: string) => void;
}) {
	const isCompleted = deliverable.status === "completed";
	const dateStr = deliverable.dueDate
		? format(new Date(deliverable.dueDate), "MMM d, yyyy")
		: null;

	return (
		<li className="flex items-center justify-between gap-x-6 py-5">
			<div className="min-w-0">
				<div className="flex items-start gap-x-3">
					<p
						className={cn(
							"text-sm/6 font-semibold text-foreground",
							isCompleted && "line-through text-muted-foreground",
						)}
					>
						{deliverable.name}
					</p>
					<p
						className={cn(
							"mt-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium capitalize whitespace-nowrap ring-1 ring-inset",
							getStatusStyle(deliverable.status),
						)}
					>
						{deliverable.status.replace("_", " ")}
					</p>
				</div>
				{dateStr && (
					<div className="mt-1 flex items-center gap-x-2 text-xs/5 text-muted-foreground">
						<p className="whitespace-nowrap">Due {dateStr}</p>
					</div>
				)}
			</div>
			<div className="flex flex-none items-center gap-x-4">
				<div className="flex -space-x-1">
					<img
						alt="Assignee"
						src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
						className="size-6 rounded-full bg-gray-50 ring-2 ring-background"
					/>
					<img
						alt="Assignee"
						src="https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
						className="size-6 rounded-full bg-gray-50 ring-2 ring-background"
					/>
					<img
						alt="Assignee"
						src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
						className="size-6 rounded-full bg-gray-50 ring-2 ring-background"
					/>
				</div>
				<Button
					variant="outline"
					size="sm"
					className="hidden sm:block"
					onClick={() => onEdit(deliverable.id)}
				>
					Details
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="-m-2.5 block p-2.5 text-muted-foreground hover:text-foreground"
						>
							<span className="sr-only">Open options</span>
							<MoreVertical className="size-5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							onClick={() => onEdit(deliverable.id)}
						>
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() =>
								console.log("Delete", deliverable.id)
							}
						>
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</li>
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

	const sortedItems = [...items].sort((a, b) => {
		const indexA = statusOrder.indexOf(a.status);
		const indexB = statusOrder.indexOf(b.status);
		const safeIndexA = indexA === -1 ? 999 : indexA;
		const safeIndexB = indexB === -1 ? 999 : indexB;
		return safeIndexA - safeIndexB;
	});

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
		<Card className="shadow-none rounded-lg">
			<CardHeader className="flex flex-row items-center justify-between space-y-0">
				<div className="space-y-1">
					<CardTitle className="text-base">Deliverables</CardTitle>
					<CardDescription>
						Photos, videos, and other deliverable items.
					</CardDescription>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => openCreate()}
				>
					<PlusIcon className="h-4 w-4 mr-1.5" />
					Add Deliverable
				</Button>
			</CardHeader>
			<CardContent>
				{items.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-8 text-center">
						<PackageIcon className="h-8 w-8 text-muted-foreground/30" />
						<p className="text-sm text-muted-foreground">
							No deliverables
						</p>
					</div>
				) : (
					<ul className="divide-y divide-border">
						{sortedItems.map((item) => (
							<DeliverableRow
								key={item.id}
								deliverable={item}
								onEdit={openEdit}
							/>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
