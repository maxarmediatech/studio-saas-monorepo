"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useTaskParams } from "@saas/studio/hooks/params/use-task-params";
import { useContextBookingId } from "@saas/studio/hooks/use-context-booking-id";
import { tasksMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { TaskForm, type TaskFormValues } from "../TaskForm";

export function TaskCreateSheet() {
	const { createTask, close } = useTaskParams();
	const bookingId = useContextBookingId();
	const isOpen = Boolean(createTask);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const createMutation = useMutation(tasksMutations.create());
	const assignMutation = useMutation(tasksMutations.assign());

	const handleSubmit = async (data: TaskFormValues) => {
		try {
			const result = await createMutation.mutateAsync({
				bookingId: data.bookingId,
				name: data.name,
				description: data.description || undefined,
				status: data.status || undefined,
				priority: data.priority || undefined,
				dueDate: data.dueDate || undefined,
				deliverableIds: data.deliverableIds,
			});

			const crewAssignments = data.crewAssignments ?? [];
			if (crewAssignments.length > 0 && result.data?.id) {
				const taskId = result.data.id;
				await Promise.all(
					crewAssignments
						.filter((a) => a.crewId)
						.map((assignment) =>
							assignMutation.mutateAsync({
								taskId,
								crewId: assignment.crewId,
							}),
						),
				);
			}

			await queryClient.invalidateQueries({
				queryKey: orpc.tasks.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.bookings.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.deliverables.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
			});
			toast.success("Task added successfully");
			close();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to add task";
			toast.error(message);
		}
	};

	const isPending = createMutation.isPending || assignMutation.isPending;

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
					<SheetTitle className="text-xl">Add Task</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					<TaskForm
						onSubmit={handleSubmit}
						mode="create"
						isPending={isPending}
						onScrollChange={setIsScrolled}
						defaultBookingId={bookingId ?? undefined}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
