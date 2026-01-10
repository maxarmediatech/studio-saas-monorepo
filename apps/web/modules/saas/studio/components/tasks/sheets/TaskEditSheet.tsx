"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useTaskParams } from "@saas/studio/hooks/params/use-task-params";
import { tasksApi, tasksMutations } from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { TaskForm, type TaskFormValues } from "../TaskForm";

export function TaskEditSheet() {
	const { taskId, close } = useTaskParams();
	const isOpen = Boolean(taskId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const { data: task, isLoading } = useQuery({
		...tasksApi.getOptions(taskId ?? ""),
		enabled: isOpen && !!taskId,
	});

	const updateMutation = useMutation(tasksMutations.update());
	const assignMutation = useMutation(tasksMutations.assign());
	const unassignMutation = useMutation(tasksMutations.unassign());

	const handleSubmit = async (data: TaskFormValues) => {
		if (!taskId) return;

		try {
			await updateMutation.mutateAsync({
				id: taskId,
				name: data.name,
				description: data.description || null,
				status: data.status || undefined,
				priority: data.priority || undefined,
				dueDate: data.dueDate || null,
			});

			const newAssignments = data.crewAssignments ?? [];
			const existingAssignments = task?.data?.assignments ?? [];

			const newCrewIds = new Set(newAssignments.map((a) => a.crewId));
			const existingCrewIds = new Set(
				existingAssignments.map((a) => a.crewId),
			);

			const toRemove = existingAssignments.filter(
				(a) => !newCrewIds.has(a.crewId),
			);
			const toAdd = newAssignments.filter(
				(a) => !existingCrewIds.has(a.crewId),
			);

			await Promise.all([
				...toRemove.map((a) =>
					unassignMutation.mutateAsync({
						taskId,
						crewId: a.crewId,
					}),
				),
				...toAdd.map((a) =>
					assignMutation.mutateAsync({
						taskId,
						crewId: a.crewId,
					}),
				),
			]);

			await queryClient.invalidateQueries({
				queryKey: orpc.tasks.key(),
			});
			toast.success("Task updated successfully");
			close();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to update task";
			toast.error(message);
		}
	};

	const isPending =
		updateMutation.isPending ||
		assignMutation.isPending ||
		unassignMutation.isPending;

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent
				side="right"
				className="sm:max-w-xl p-0 gap-0 flex flex-col"
			>
				<SheetHeader
					className={cn(
						"shrink-0 p-4 transition-shadow duration-200",
						isScrolled &&
							"shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]",
					)}
				>
					<SheetTitle className="text-xl">Edit Task</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					{isLoading ? (
						<div className="space-y-4 px-4 py-4">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
						</div>
					) : (
						<TaskForm
							defaultValues={task?.data}
							existingAssignments={task?.data?.assignments}
							booking={task?.data?.booking}
							onSubmit={handleSubmit}
							mode="edit"
							isPending={isPending}
							onScrollChange={setIsScrolled}
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
