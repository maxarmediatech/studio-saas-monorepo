"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useTaskParams } from "@saas/studio/hooks/params";
import { tasksApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format, isPast, isToday } from "date-fns";
import {
	AlertCircleIcon,
	CalendarIcon,
	CheckSquareIcon,
	PlusIcon,
} from "lucide-react";
import { getPriorityVariant, getStatusVariant } from "../utils";

interface TasksTabProps {
	bookingId: string;
}

type Task = {
	id: string;
	name: string;
	description?: string | null;
	status: string;
	priority?: string | null;
	dueDate?: string | null;
};

const statusOrder = ["in_progress", "pending", "completed", "cancelled"];

function TaskRow({
	task,
	onEdit,
}: {
	task: Task;
	onEdit: (id: string) => void;
}) {
	const isOverdue =
		task.dueDate &&
		isPast(new Date(task.dueDate)) &&
		!isToday(new Date(task.dueDate)) &&
		task.status !== "completed" &&
		task.status !== "cancelled";

	const isCompleted = task.status === "completed";

	return (
		<button
			type="button"
			onClick={() => onEdit(task.id)}
			className="w-full flex items-center justify-between gap-4 py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
		>
			<div className="flex-1 min-w-0 space-y-1">
				<div
					className={cn(
						"font-medium truncate",
						isCompleted && "text-muted-foreground line-through",
					)}
				>
					{task.name}
				</div>
				<div className="flex items-center gap-2 text-xs">
					{task.dueDate && (
						<span
							className={cn(
								"flex items-center gap-1",
								isOverdue
									? "text-red-600"
									: "text-muted-foreground",
							)}
						>
							<CalendarIcon className="h-3 w-3" />
							{isOverdue && "Overdue: "}
							{format(new Date(task.dueDate), "MMM d")}
						</span>
					)}
					{task.priority && task.priority !== "medium" && (
						<Badge
							variant={getPriorityVariant(task.priority)}
							className="text-[10px] h-5 capitalize"
						>
							{task.priority}
						</Badge>
					)}
				</div>
			</div>
			<Badge
				variant={getStatusVariant(task.status)}
				className="shrink-0 capitalize text-xs"
			>
				{task.status.replace("_", " ")}
			</Badge>
		</button>
	);
}

export function TasksTab({ bookingId }: TasksTabProps) {
	const { openCreate, openEdit } = useTaskParams();

	const {
		data: tasks,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...tasksApi.listOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const tasksList = tasks?.data ?? [];

	const grouped = new Map<string, Task[]>();
	for (const status of statusOrder) {
		grouped.set(status, []);
	}
	for (const task of tasksList) {
		if (grouped.has(task.status)) {
			grouped.get(task.status)?.push(task);
		} else {
			grouped.get("pending")?.push(task);
		}
	}
	for (const [key, value] of grouped.entries()) {
		if (value.length === 0) grouped.delete(key);
	}

	if (isLoading) {
		return (
			<div className="space-y-3">
				<div className="flex justify-end">
					<Skeleton className="h-9 w-24" />
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
					Failed to load tasks
				</p>
				<Button variant="outline" size="sm" onClick={() => refetch()}>
					Try again
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h3 className="font-bold text-2xl mb-2">Tasks</h3>
					<p className="text-muted-foreground mb-6">
						To-do items and action items for this booking.
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => openCreate()}
				>
					<PlusIcon className="h-4 w-4 mr-1.5" />
					Add Task
				</Button>
			</div>

			{tasksList.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-12 text-center">
					<CheckSquareIcon className="h-8 w-8 text-muted-foreground/30" />
					<p className="text-sm text-muted-foreground">No tasks</p>
				</div>
			) : (
				<div className="space-y-6">
					{Array.from(grouped.entries()).map(([status, group]) => (
						<div key={status}>
							<div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
								{status.replace("_", " ")} ({group.length})
							</div>
							<div className="divide-y">
								{group.map((task) => (
									<TaskRow
										key={task.id}
										task={task}
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
