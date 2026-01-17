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
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { quickLinksMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const quickLinkSchema = z.object({
	url: z.string().url("Must be a valid URL"),
	title: z.string().optional(),
});

type QuickLinkFormValues = z.infer<typeof quickLinkSchema>;

interface QuickLinkModalProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	initialData?: {
		id: string;
		url: string;
		title?: string | null;
	} | null;
}

export function QuickLinkModal({
	isOpen,
	onOpenChange,
	initialData,
}: QuickLinkModalProps) {
	const queryClient = useQueryClient();
	const isEditing = !!initialData;

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<QuickLinkFormValues>({
		resolver: zodResolver(quickLinkSchema),
		defaultValues: {
			url: "",
			title: "",
		},
	});

	useEffect(() => {
		if (isOpen) {
			reset({
				url: initialData?.url ?? "",
				title: initialData?.title ?? "",
			});
		} else {
			reset({
				url: "",
				title: "",
			});
		}
	}, [isOpen, initialData, reset]);

	const createMutation = useMutation({
		...quickLinksMutations.create(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.quickLinks.key() });
			toast.success("Quick link created");
			onOpenChange(false);
		},
		onError: () => {
			toast.error("Failed to create quick link");
		},
	});

	const updateMutation = useMutation({
		...quickLinksMutations.update(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.quickLinks.key() });
			toast.success("Quick link updated");
			onOpenChange(false);
		},
		onError: () => {
			toast.error("Failed to update quick link");
		},
	});

	const onSubmit = (values: QuickLinkFormValues) => {
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
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Edit Quick Link" : "Add Quick Link"}
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<Field>
						<FieldLabel>URL</FieldLabel>
						<Input
							placeholder="https://example.com"
							{...register("url")}
						/>
						{errors.url && (
							<FieldError>{errors.url.message}</FieldError>
						)}
					</Field>

					<Field>
						<FieldLabel>Title (Optional)</FieldLabel>
						<Input
							placeholder="Display name"
							{...register("title")}
						/>
						{errors.title && (
							<FieldError>{errors.title.message}</FieldError>
						)}
					</Field>

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
									: "Add"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
