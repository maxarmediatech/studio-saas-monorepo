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
import { useTaskParams } from "@saas/studio/hooks/params";
import { tasksApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isTomorrow, isThisWeek, isPast } from "date-fns";
import {
	AlertCircleIcon,
	CalendarIcon,
	CheckSquare,
	PencilIcon,
	PlusIcon,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface TasksTabProps {
	bookingId: string;
}

type TaskStatus = "todo" | "in_progress" | "completed" | "cancelled";
type TaskPriority = "high" | "medium" | "low";

// ============================================================================
// Utilities
// ============================================================================

function getStatusVariant(
	status: string,
): "default" | "secondary" | "destructive" | "outline" {
	switch (status) {
		case "todo":
			return "secondary";
		case "in_progress":
			return "default";
		case "completed":
			return "outline";
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

function getDueDateGroup(dueDate: string | null | undefined): string {
	if (!dueDate) return "no-date";
	const date = new Date(dueDate);
	if (isPast(date) && !isToday(date)) return "overdue";
	if (isToday(date)) return "today";
	if (isTomorrow(date)) return "tomorrow";
	if (isThisWeek(date)) return "this-week";
	return "upcoming";
}

// Task type for internal use
type Task = {
	id: string;
	name: string;
	description?: string | null;
	status: string;
	priority?: string | null;
	dueDate?: string | null;
};

function groupTasksByStatus(tasks: Task[]) {
	const order: TaskStatus[] = ["in_progress", "todo", "completed", "cancelled"];
	const grouped = new Map<string, Task[]>();

	for (const status of order) {
		grouped.set(status, []);
	}

	for (const task of tasks) {
		const status = task.status as TaskStatus;
		if (grouped.has(status)) {
			grouped.get(status)?.push(task);
		} else {
			grouped.get("todo")?.push(task);
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

function groupTasksByPriority(tasks: Task[]) {
	const order: TaskPriority[] = ["high", "medium", "low"];
	const grouped = new Map<string, Task[]>();

	for (const priority of order) {
		grouped.set(priority, []);
	}
	grouped.set("none", []);

	for (const task of tasks) {
		const priority = (task.priority as TaskPriority) || "none";
		if (grouped.has(priority)) {
			grouped.get(priority)?.push(task);
		} else {
			grouped.get("none")?.push(task);
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

function groupTasksByDueDate(tasks: Task[]) {
	const order = ["overdue", "today", "tomorrow", "this-week", "upcoming", "no-date", "completed"];
	const grouped = new Map<string, Task[]>();

	for (const key of order) {
		grouped.set(key, []);
	}

	for (const task of tasks) {
		if (task.status === "completed") {
			grouped.get("completed")?.push(task);
		} else {
			const group = getDueDateGroup(task.dueDate);
			grouped.get(group)?.push(task);
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

const dueDateLabels: Record<string, string> = {
	overdue: "Overdue",
	today: "Today",
	tomorrow: "Tomorrow",
	"this-week": "This Week",
	upcoming: "Upcoming",
	"no-date": "No Due Date",
	completed: "Completed",
};

// ============================================================================
// Sub-Components
// ============================================================================

function TaskCard({
	task,
	onEdit,
}: {
	task: {
		id: string;
		name: string;
		description?: string | null;
		status: string;
		priority?: string | null;
		dueDate?: string | null;
	};
	onEdit: (id: string) => void;
}) {
	const isOverdue =
		task.dueDate &&
		isPast(new Date(task.dueDate)) &&
		!isToday(new Date(task.dueDate)) &&
		task.status !== "completed";

	return (
		<div className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3 hover:bg-muted/50 transition-colors">
			<div className="flex-1 space-y-1.5 min-w-0">
				<h4 className="font-medium truncate">{task.name}</h4>

				<div className="flex items-center gap-1.5 flex-wrap">
					<Badge
						variant={getStatusVariant(task.status)}
						className="text-xs capitalize"
					>
						{task.status.replace("_", " ")}
					</Badge>

					{task.priority && (
						<Badge
							variant={getPriorityVariant(task.priority)}
							className="text-xs capitalize"
						>
							{task.priority}
						</Badge>
					)}

					{isOverdue && (
						<Badge variant="destructive" className="text-xs">
							Overdue
						</Badge>
					)}
				</div>

				{task.dueDate && (
					<div
						className={`flex items-center gap-1 text-xs ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}
					>
						<CalendarIcon className="h-3 w-3" />
						<span>
							Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
						</span>
					</div>
				)}

				{task.description && (
					<p className="text-xs text-muted-foreground line-clamp-1">
						{task.description}
					</p>
				)}
			</div>

			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8 shrink-0"
				onClick={() => onEdit(task.id)}
				aria-label={`Edit ${task.name}`}
			>
				<PencilIcon className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}

function TasksList({
	tasks,
	onEdit,
	onCreate,
	emptyMessage,
	groupBy,
}: {
	tasks: Array<{
		id: string;
		name: string;
		description?: string | null;
		status: string;
		priority?: string | null;
		dueDate?: string | null;
	}>;
	onEdit: (id: string) => void;
	onCreate: () => void;
	emptyMessage: string;
	groupBy?: "status" | "priority" | "dueDate";
}) {
	if (tasks.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 py-8 text-center">
				<CheckSquare className="h-8 w-8 text-muted-foreground/50" />
				<p className="text-sm text-muted-foreground">{emptyMessage}</p>
				<Button variant="outline" size="sm" onClick={onCreate}>
					<PlusIcon className="h-4 w-4 mr-2" />
					Add Task
				</Button>
			</div>
		);
	}

	if (groupBy === "status") {
		const grouped = groupTasksByStatus(tasks);
		return (
			<div className="space-y-6">
				{Array.from(grouped.entries()).map(([status, items]) => (
					<div key={status} className="space-y-3">
						<h4 className="text-sm font-medium text-muted-foreground capitalize">
							{status.replace("_", " ")} ({items.length})
						</h4>
						<div className="space-y-2">
							{items.map((task) => (
								<TaskCard key={task.id} task={task} onEdit={onEdit} />
							))}
						</div>
					</div>
				))}
			</div>
		);
	}

	if (groupBy === "priority") {
		const grouped = groupTasksByPriority(tasks);
		return (
			<div className="space-y-6">
				{Array.from(grouped.entries()).map(([priority, items]) => (
					<div key={priority} className="space-y-3">
						<h4 className="text-sm font-medium text-muted-foreground capitalize">
							{priority === "none" ? "No Priority" : priority} ({items.length})
						</h4>
						<div className="space-y-2">
							{items.map((task) => (
								<TaskCard key={task.id} task={task} onEdit={onEdit} />
							))}
						</div>
					</div>
				))}
			</div>
		);
	}

	if (groupBy === "dueDate") {
		const grouped = groupTasksByDueDate(tasks);
		return (
			<div className="space-y-6">
				{Array.from(grouped.entries()).map(([key, items]) => (
					<div key={key} className="space-y-3">
						<h4
							className={`text-sm font-medium ${key === "overdue" ? "text-destructive" : "text-muted-foreground"}`}
						>
							{dueDateLabels[key] || key} ({items.length})
						</h4>
						<div className="space-y-2">
							{items.map((task) => (
								<TaskCard key={task.id} task={task} onEdit={onEdit} />
							))}
						</div>
					</div>
				))}
			</div>
		);
	}

	// Default: flat list
	return (
		<div className="space-y-2">
			{tasks.map((task) => (
				<TaskCard key={task.id} task={task} onEdit={onEdit} />
			))}
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

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
	const completedCount = tasksList.filter(
		(t) => t.status === "completed",
	).length;
	const progressPercentage =
		tasksList.length > 0 ? (completedCount / tasksList.length) * 100 : 0;

	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center gap-2 py-8 text-center">
				<AlertCircleIcon className="h-8 w-8 text-destructive/50" />
				<p className="text-sm text-destructive">Failed to load tasks</p>
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
							<CheckSquare className="h-4 w-4" />
							Tasks
							<Badge variant="secondary" className="text-xs">
								{tasksList.length}
							</Badge>
						</CardTitle>
						<Button
							variant="outline"
							size="sm"
							onClick={() => openCreate()}
						>
							<PlusIcon className="h-4 w-4 mr-1" />
							Add Task
						</Button>
					</div>
				</CardHeader>
				{tasksList.length > 0 && (
					<CardContent className="pt-0 pb-4">
						<div className="space-y-2">
							<Progress value={progressPercentage} className="h-2" />
							<p className="text-xs text-muted-foreground">
								{completedCount} of {tasksList.length} completed
							</p>
						</div>
					</CardContent>
				)}
			</Card>

			{/* Sub-tabs for different views */}
			<Tabs defaultValue="all" className="space-y-4">
				<CustomTabsList>
					<CustomTabsTrigger value="all">All</CustomTabsTrigger>
					<CustomTabsTrigger value="by-status">By Status</CustomTabsTrigger>
					<CustomTabsTrigger value="by-priority">By Priority</CustomTabsTrigger>
					<CustomTabsTrigger value="by-due-date">By Due Date</CustomTabsTrigger>
				</CustomTabsList>

				<CustomTabsContent value="all">
					<TasksList
						tasks={tasksList}
						onEdit={openEdit}
						onCreate={openCreate}
						emptyMessage="No tasks created"
					/>
				</CustomTabsContent>

				<CustomTabsContent value="by-status">
					<TasksList
						tasks={tasksList}
						onEdit={openEdit}
						onCreate={openCreate}
						emptyMessage="No tasks created"
						groupBy="status"
					/>
				</CustomTabsContent>

				<CustomTabsContent value="by-priority">
					<TasksList
						tasks={tasksList}
						onEdit={openEdit}
						onCreate={openCreate}
						emptyMessage="No tasks created"
						groupBy="priority"
					/>
				</CustomTabsContent>

				<CustomTabsContent value="by-due-date">
					<TasksList
						tasks={tasksList}
						onEdit={openEdit}
						onCreate={openCreate}
						emptyMessage="No tasks created"
						groupBy="dueDate"
					/>
				</CustomTabsContent>
			</Tabs>
		</div>
	);
}
