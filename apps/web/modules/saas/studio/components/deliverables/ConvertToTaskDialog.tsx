"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/button";
import { DatePicker } from "@repo/ui/components/date-picker";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { deliverablesMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

interface ConvertableDeliverable {
	id: string;
	name: string;
	description: string | null;
	dueDate: string | null;
	metadata: Record<string, unknown> | null;
}

interface ConvertToTaskDialogProps {
	deliverable: ConvertableDeliverable | null;
	organizationSlug: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const convertToTaskSchema = z.object({
	taskName: z.string().min(1, "Task name is required").max(200),
	taskDescription: z.string().max(5000).optional(),
	taskPriority: z.enum(["low", "normal", "medium", "high"]),
	taskDueDate: z.string().optional(),
});

type ConvertToTaskFormValues = z.infer<typeof convertToTaskSchema>;

function getConvertedTaskId(
	metadata: Record<string, unknown> | null | undefined,
): string | null {
	const value = metadata?.convertedToTaskId;
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function extractTaskIdFromConflictMessage(message: string): string | null {
	const match = message.match(/\(([^)]+)\)\s*$/);
	if (!match) {
		return null;
	}

	const taskId = match[1]?.trim();
	return taskId ? taskId : null;
}

export function ConvertToTaskDialog({
	deliverable,
	organizationSlug,
	open,
	onOpenChange,
}: ConvertToTaskDialogProps) {
	const queryClient = useQueryClient();
	const [resolvedTaskId, setResolvedTaskId] = useState<string | null>(null);
	const convertedTaskId = getConvertedTaskId(deliverable?.metadata);
	const taskId = resolvedTaskId ?? convertedTaskId;
	const taskHref = useMemo(
		() => (taskId ? `/app/${organizationSlug}/tasks/${taskId}` : null),
		[organizationSlug, taskId],
	);
	const hasLinkedTask = Boolean(taskHref);

	const {
		register,
		handleSubmit,
		reset,
		control,
		formState: { errors },
	} = useForm<ConvertToTaskFormValues>({
		resolver: zodResolver(convertToTaskSchema),
		defaultValues: {
			taskName: "",
			taskDescription: "",
			taskPriority: "normal",
			taskDueDate: undefined,
		},
	});

	useEffect(() => {
		if (open && deliverable) {
			setResolvedTaskId(null);
			reset({
				taskName: `Task: ${deliverable.name}`,
				taskDescription: deliverable.description ?? "",
				taskPriority: "normal",
				taskDueDate: deliverable.dueDate ?? undefined,
			});
		} else if (!open) {
			setResolvedTaskId(null);
			reset({
				taskName: "",
				taskDescription: "",
				taskPriority: "normal",
				taskDueDate: undefined,
			});
		}
	}, [open, deliverable, reset]);

	const convertMutation = useMutation({
		...deliverablesMutations.convertToTask(),
		onSuccess: (response) => {
			toast.success("Deliverable converted to task successfully");
			queryClient.invalidateQueries({
				queryKey: orpc.deliverables.key(),
			});
			queryClient.invalidateQueries({ queryKey: orpc.tasks.key() });
			queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
			});
			setResolvedTaskId(response.data.taskId);
		},
		onError: (error) => {
			const message =
				error.message || "Failed to convert deliverable to task";
			const isAlreadyConvertedError = message
				.toLowerCase()
				.includes("already converted");

			if (isAlreadyConvertedError) {
				const conflictedTaskId =
					taskId ?? extractTaskIdFromConflictMessage(message);
				queryClient.invalidateQueries({
					queryKey: orpc.deliverables.key(),
				});
				queryClient.invalidateQueries({ queryKey: orpc.tasks.key() });

				if (!conflictedTaskId) {
					toast.info("Deliverable already converted to a task.");
					return;
				}

				setResolvedTaskId(conflictedTaskId);
				return;
			}

			toast.error(message);
		},
	});

	const onSubmit = (values: ConvertToTaskFormValues) => {
		if (!deliverable) {
			return;
		}

		convertMutation.mutate({
			deliverableId: deliverable.id,
			taskName: values.taskName,
			taskDescription: values.taskDescription || undefined,
			taskPriority: values.taskPriority,
			taskDueDate: values.taskDueDate || undefined,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle>Convert to Task</DialogTitle>
					<DialogDescription>
						{hasLinkedTask
							? "This deliverable is linked to a task."
							: "Create a new task from this deliverable. Crew assignments will be copied automatically."}
					</DialogDescription>
					{hasLinkedTask && (
						<p className="text-sm text-muted-foreground mt-1">
							Use View Task to open the linked task.
						</p>
					)}
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					{!hasLinkedTask && (
						<>
							<Field>
								<FieldLabel>Task Name</FieldLabel>
								<Input
									placeholder="Enter task name"
									{...register("taskName")}
								/>
								{errors.taskName && (
									<FieldError>
										{errors.taskName.message}
									</FieldError>
								)}
							</Field>

							<Field>
								<FieldLabel>Description (optional)</FieldLabel>
								<Textarea
									placeholder="Task description"
									rows={2}
									{...register("taskDescription")}
								/>
								{errors.taskDescription && (
									<FieldError>
										{errors.taskDescription.message}
									</FieldError>
								)}
							</Field>

							<div className="grid grid-cols-2 gap-4">
								<Controller
									name="taskPriority"
									control={control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel htmlFor={field.name}>
												Priority
											</FieldLabel>
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<SelectTrigger
													id={field.name}
													aria-invalid={
														fieldState.invalid
													}
												>
													<SelectValue placeholder="Select priority" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="low">
														Low
													</SelectItem>
													<SelectItem value="normal">
														Normal
													</SelectItem>
													<SelectItem value="medium">
														Medium
													</SelectItem>
													<SelectItem value="high">
														High
													</SelectItem>
												</SelectContent>
											</Select>
											{fieldState.invalid && (
												<FieldError
													errors={[fieldState.error]}
												/>
											)}
										</Field>
									)}
								/>

								<Controller
									name="taskDueDate"
									control={control}
									render={({ field, fieldState }) => (
										<Field
											data-invalid={fieldState.invalid}
										>
											<FieldLabel htmlFor={field.name}>
												Due Date
											</FieldLabel>
											<DatePicker
												value={field.value}
												onValueChange={field.onChange}
												id={field.name}
												aria-invalid={
													fieldState.invalid
												}
											/>
											{fieldState.invalid && (
												<FieldError
													errors={[fieldState.error]}
												/>
											)}
										</Field>
									)}
								/>
							</div>
						</>
					)}

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							{hasLinkedTask ? "Close" : "Cancel"}
						</Button>
						{taskHref ? (
							<Button type="button" asChild>
								<Link
									href={taskHref}
									target="_blank"
									rel="noopener noreferrer"
								>
									View Task
								</Link>
							</Button>
						) : (
							<Button
								type="submit"
								disabled={convertMutation.isPending}
							>
								{convertMutation.isPending
									? "Converting..."
									: "Convert to Task"}
							</Button>
						)}
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
