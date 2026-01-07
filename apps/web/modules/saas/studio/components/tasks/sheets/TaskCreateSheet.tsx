"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useTaskParams } from "@saas/studio/hooks/params/use-task-params";
import { tasksMutations } from "@saas/studio/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { TaskForm, type TaskFormValues } from "../TaskForm";

export function TaskCreateSheet() {
	const { createTask, close } = useTaskParams();
	const isOpen = Boolean(createTask);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const createMutation = useMutation({
		...tasksMutations.create(),
		onSuccess: () => {
			toast.success("Task added successfully");
			queryClient.invalidateQueries({
				queryKey: orpc.tasks.key(),
			});
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
					<SheetTitle className="text-xl">Add Task</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					<TaskForm
						onSubmit={handleSubmit}
						mode="create"
						isPending={createMutation.isPending}
						onScrollChange={setIsScrolled}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
