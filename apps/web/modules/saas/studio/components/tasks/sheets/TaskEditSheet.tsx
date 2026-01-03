"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useTaskParams } from "@saas/studio/hooks/params/use-task-params";
import {
	studioQueryKeys,
	tasksApi,
	tasksMutations,
} from "@saas/studio/lib/api";
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

	const updateMutation = useMutation({
		...tasksMutations.update(),
		onSuccess: () => {
			toast.success("Task updated successfully");
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.tasks.all,
			});
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update task");
		},
	});

	const handleSubmit = async (data: TaskFormValues) => {
		if (!taskId) {
			return;
		}

		await updateMutation.mutateAsync({
			id: taskId,
			name: data.name,
			description: data.description || null,
			status: data.status || undefined,
			priority: data.priority || undefined,
			dueDate: data.dueDate || null,
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent
				side="right"
				className="sm:max-w-md p-0 gap-0 flex flex-col"
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
							<Skeleton className="h-24 w-full" />
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<Skeleton className="h-10 w-full" />
						</div>
					) : (
						<TaskForm
							defaultValues={task?.data}
							onSubmit={handleSubmit}
							mode="edit"
							isPending={updateMutation.isPending}
							onScrollChange={setIsScrolled}
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
