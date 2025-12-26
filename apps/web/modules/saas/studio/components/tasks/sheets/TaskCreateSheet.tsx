"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Button } from "@repo/ui/components/button";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTaskParams } from "@saas/studio/hooks/params/use-task-params";
import { TaskForm, type TaskFormValues } from "../TaskForm";
import { tasksMutations, studioQueryKeys } from "@saas/studio/lib/api";

export function TaskCreateSheet() {
	const { createTask, close } = useTaskParams();
	const isOpen = Boolean(createTask);
	const queryClient = useQueryClient();

	const createMutation = useMutation({
		...tasksMutations.create(),
		onSuccess: () => {
			toast.success("Task added successfully");
			queryClient.invalidateQueries({ queryKey: studioQueryKeys.tasks.all });
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to add task");
		},
	});

	const handleSubmit = async (data: TaskFormValues) => {
		await createMutation.mutateAsync({
			bookingId: data.bookingId,
			name: data.name,
			description: data.description || undefined,
			status: data.status || undefined,
			priority: data.priority || undefined,
			dueDate: data.dueDate || undefined,
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent side="right" className="sm:max-w-lg">
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<SheetTitle className="text-xl">Add Task</SheetTitle>
					<Button
						size="icon"
						variant="ghost"
						onClick={close}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</SheetHeader>
				<TaskForm
					onSubmit={handleSubmit}
					mode="create"
					isPending={createMutation.isPending}
				/>
			</SheetContent>
		</Sheet>
	);
}
