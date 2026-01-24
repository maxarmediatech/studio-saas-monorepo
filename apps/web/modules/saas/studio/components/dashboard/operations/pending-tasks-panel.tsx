"use client";

import type { PendingTaskItem } from "@repo/api/modules/studio/schemas/dashboard";
import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import { AlertTriangleIcon, CheckSquareIcon } from "lucide-react";
import Link from "next/link";

interface PendingTasksPanelProps {
	tasks: PendingTaskItem[];
	organizationSlug: string;
}

export function PendingTasksPanel({
	tasks,
	organizationSlug,
}: PendingTasksPanelProps) {
	const hasData = tasks.length > 0;

	return (
		<Card className="flex flex-col">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-base">
						<CheckSquareIcon className="size-4" />
						Pending Tasks
					</CardTitle>
					<Link
						href={`/app/${organizationSlug}/tasks`}
						className="text-xs text-muted-foreground hover:text-foreground"
					>
						View all
					</Link>
				</div>
			</CardHeader>
			<CardContent className="flex-1 overflow-auto">
				{!hasData ? (
					<div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
						No pending tasks in this range
					</div>
				) : (
					<div className="space-y-3">
						{tasks.map((task) => (
							<TaskItem
								key={task.id}
								task={task}
								organizationSlug={organizationSlug}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function TaskItem({
	task,
	organizationSlug,
}: {
	task: PendingTaskItem;
	organizationSlug: string;
}) {
	return (
		<Link
			href={`/app/${organizationSlug}/tasks/${task.id}`}
			className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<p className="truncate font-medium">{task.name}</p>
						{task.isOverdue && (
							<AlertTriangleIcon className="size-3.5 shrink-0 text-destructive" />
						)}
					</div>
					<p className="truncate text-xs text-muted-foreground">
						{task.bookingName}
					</p>
				</div>
				<PriorityBadge priority={task.priority} />
			</div>
			<div className="mt-2 flex flex-wrap items-center gap-2">
				{task.dueDate && (
					<Badge
						variant={task.isOverdue ? "destructive" : "outline"}
						className="text-xs"
					>
						{task.isOverdue ? "Overdue: " : "Due: "}
						{task.dueDate}
					</Badge>
				)}
				<WorkflowStatusBadge status={task.workflowStatus} />
			</div>
			{task.assignedCrew.length > 0 && (
				<div className="mt-2 flex flex-wrap gap-1">
					{task.assignedCrew.slice(0, 2).map((crew) => (
						<Badge
							key={crew.id}
							variant="secondary"
							className="text-xs"
						>
							{crew.name}
						</Badge>
					))}
					{task.assignedCrew.length > 2 && (
						<Badge variant="outline" className="text-xs">
							+{task.assignedCrew.length - 2}
						</Badge>
					)}
				</div>
			)}
		</Link>
	);
}

function PriorityBadge({ priority }: { priority: string }) {
	const priorityLower = priority.toLowerCase();
	return (
		<Badge
			className={cn(
				"shrink-0 text-xs",
				priorityLower === "high" &&
					"bg-red-500/10 text-red-600 border-red-500/20",
				priorityLower === "medium" &&
					"bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
				priorityLower === "low" &&
					"bg-gray-500/10 text-gray-600 border-gray-500/20",
			)}
			variant="outline"
		>
			{priority}
		</Badge>
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
