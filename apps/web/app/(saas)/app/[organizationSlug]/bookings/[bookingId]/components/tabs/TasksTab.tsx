"use client";

import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useTaskParams } from "@saas/studio/hooks/params";
import { tasksApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
	AlertCircleIcon,
	CheckSquareIcon,
	MoreVertical,
	PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface TasksTabProps {
	bookingId: string;
}

const statusOrder = ["in_progress", "pending", "completed", "cancelled"];

const STATUS_STYLES: Record<string, string> = {
	pending: "text-gray-600 bg-gray-50 ring-gray-500/10",
	in_progress: "text-blue-700 bg-blue-50 ring-blue-600/20",
	completed: "text-green-700 bg-green-50 ring-green-600/20",
	cancelled: "text-red-700 bg-red-50 ring-red-600/20",
};

function getStatusStyle(status: string) {
	return STATUS_STYLES[status] || "text-gray-600 bg-gray-50 ring-gray-500/10";
}

export function TasksTab({ bookingId }: TasksTabProps) {
	const { openCreate, openEdit } = useTaskParams();
	const { organizationSlug } = useParams<{ organizationSlug: string }>();

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

	const sortedTasks = [...tasksList].sort((a, b) => {
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
		<Card className="rounded-lg">
			<CardHeader className="flex flex-row items-center justify-between space-y-0">
				<div className="space-y-1">
					<CardTitle className="text-base">Tasks</CardTitle>
					<CardDescription>
						To-do items and action items for this booking.
					</CardDescription>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => openCreate()}
				>
					<PlusIcon className="h-4 w-4 mr-1.5" />
					Add Task
				</Button>
			</CardHeader>
			<CardContent>
				{tasksList.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-8 text-center">
						<CheckSquareIcon className="h-8 w-8 text-muted-foreground/30" />
						<p className="text-sm text-muted-foreground">
							No tasks
						</p>
					</div>
				) : (
					<ul className="divide-y divide-border">
						{sortedTasks.map((task) => {
							const isCompleted = task.status === "completed";

							return (
								<li
									key={task.id}
									className="flex items-center justify-between gap-x-6 py-5"
								>
									<div className="flex-1 min-w-0">
										<div className="flex items-start gap-x-3">
											<p
												className={cn(
													"text-sm/6 font-semibold text-foreground",
													isCompleted &&
														"line-through text-muted-foreground",
												)}
											>
												{task.name}
											</p>
											<p
												className={cn(
													"mt-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium capitalize whitespace-nowrap ring-1 ring-inset",
													getStatusStyle(task.status),
												)}
											>
												{task.status.replace("_", " ")}
											</p>
										</div>
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
										{organizationSlug ? (
											<Button
												variant="outline"
												size="sm"
												className="hidden sm:block"
												asChild
											>
												<Link
													href={`/app/${organizationSlug}/tasks/${task.id}`}
													target="_blank"
													rel="noopener noreferrer"
												>
													Details
												</Link>
											</Button>
										) : (
											<Button
												variant="outline"
												size="sm"
												className="hidden sm:block"
												onClick={() =>
													openEdit(task.id)
												}
											>
												Details
											</Button>
										)}
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className="-m-2.5 block p-2.5 text-muted-foreground hover:text-foreground"
												>
													<span className="sr-only">
														Open options
													</span>
													<MoreVertical className="size-5" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem
													onClick={() =>
														openEdit(task.id)
													}
												>
													Edit
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() =>
														console.log(
															"Delete",
															task.id,
														)
													}
												>
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
