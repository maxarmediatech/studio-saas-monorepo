"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldError } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { stickiesMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { STICKY_COLORS, type StickyColor } from "./constants";
import { StickyColorPicker } from "./sticky-color-picker";

const stickySchema = z.object({
	title: z.string().optional(),
	content: z.string().optional(),
	color: z.enum(
		Object.keys(STICKY_COLORS) as [StickyColor, ...StickyColor[]],
	),
});

type StickyFormValues = z.infer<typeof stickySchema>;

interface StickyModalProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	initialData?: {
		id: string;
		title: string | null;
		content: string | null;
		color: string;
	} | null;
}

export function StickyModal({
	isOpen,
	onOpenChange,
	initialData,
}: StickyModalProps) {
	const queryClient = useQueryClient();
	const isEditing = !!initialData;

	const {
		register,
		handleSubmit,
		reset,
		control,
		formState: { errors },
	} = useForm<StickyFormValues>({
		resolver: zodResolver(stickySchema),
		defaultValues: {
			title: "",
			content: "",
			color: "yellow",
		},
	});

	useEffect(() => {
		if (isOpen) {
			reset({
				title: initialData?.title ?? "",
				content: initialData?.content ?? "",
				color: (initialData?.color as StickyColor) ?? "yellow",
			});
		} else {
			reset({
				title: "",
				content: "",
				color: "yellow",
			});
		}
	}, [isOpen, initialData, reset]);

	const createMutation = useMutation({
		...stickiesMutations.create(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.stickies.key() });
			toast.success("Sticky created");
			onOpenChange(false);
		},
		onError: () => {
			toast.error("Failed to create sticky");
		},
	});

	const updateMutation = useMutation({
		...stickiesMutations.update(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.stickies.key() });
			toast.success("Sticky updated");
			onOpenChange(false);
		},
		onError: () => {
			toast.error("Failed to update sticky");
		},
	});

	const onSubmit = (values: StickyFormValues) => {
		if (isEditing && initialData) {
			updateMutation.mutate({
				id: initialData.id,
				...values,
			});
		} else {
			createMutation.mutate(values);
		}
	};

	const isPending = createMutation.isPending || updateMutation.isPending;

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Edit Sticky" : "New Sticky"}
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<Field>
						<Input
							placeholder="Quick note title..."
							className="font-medium"
							{...register("title")}
						/>
						{errors.title && (
							<FieldError>{errors.title.message}</FieldError>
						)}
					</Field>

					<Field>
						<Textarea
							placeholder="Write your note here..."
							className="min-h-[120px] resize-none"
							{...register("content")}
						/>
						{errors.content && (
							<FieldError>{errors.content.message}</FieldError>
						)}
					</Field>

					<Controller
						control={control}
						name="color"
						render={({ field }) => (
							<StickyColorPicker
								value={field.value}
								onChange={field.onChange}
							/>
						)}
					/>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending
								? "Saving..."
								: isEditing
									? "Update"
									: "Save"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
