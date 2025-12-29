"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTaskParams } from "@saas/studio/hooks/params/use-task-params";
import { TaskForm, type TaskFormValues } from "../TaskForm";
import {
	tasksApi,
	tasksMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";

export function TaskEditSheet() {
	const { taskId, close } = useTaskParams();
	const isOpen = Boolean(taskId);
	const queryClient = useQueryClient();

	const { data: task, isLoading } = useQuery({
		...tasksApi.getOptions(taskId!),
		enabled: isOpen && !!taskId,
	});

	const updateMutation = useMutation({
		...tasksMutations.update(),
		onSuccess: () => {
			toast.success("Task updated successfully");
			queryClient.invalidateQueries({ queryKey: studioQueryKeys.tasks.all });
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update task");
		},
	});

	const handleSubmit = async (data: TaskFormValues) => {
		if (!taskId) return;

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
			<SheetContent side="right" className="sm:max-w-md">
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<SheetTitle className="text-xl">Edit Task</SheetTitle>
					<Button
						size="icon"
						variant="ghost"
						onClick={close}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</SheetHeader>
				<div className="px-4">
					{isLoading ? (
						<div className="space-y-4">
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
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
