"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/button";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { discussionsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const discussionSchema = z.object({
	title: z.string().min(1, "Title is required").max(200),
	content: z.string().max(10000).optional(),
});

type DiscussionFormValues = z.infer<typeof discussionSchema>;

interface DiscussionCreateFormProps {
	channelId: string;
	onCancel: () => void;
	onSuccess: () => void;
}

export function DiscussionCreateForm({
	channelId,
	onCancel,
	onSuccess,
}: DiscussionCreateFormProps) {
	const queryClient = useQueryClient();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<DiscussionFormValues>({
		resolver: zodResolver(discussionSchema),
		defaultValues: {
			title: "",
			content: "",
		},
	});

	const createMutation = useMutation({
		...discussionsMutations.createDiscussion(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.discussions.listDiscussions.key(),
			});
			toast.success("Discussion created");
			onSuccess();
		},
		onError: () => {
			toast.error("Failed to create discussion");
		},
	});

	const onSubmit = (values: DiscussionFormValues) => {
		createMutation.mutate({
			channelId,
			title: values.title,
			content: values.content || undefined,
		});
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			<Field>
				<FieldLabel>Title</FieldLabel>
				<Input
					placeholder="What would you like to discuss?"
					autoFocus
					{...register("title")}
				/>
				{errors.title && (
					<FieldError>{errors.title.message}</FieldError>
				)}
			</Field>

			<Field>
				<FieldLabel>Details (optional)</FieldLabel>
				<Textarea
					placeholder="Add more context..."
					rows={4}
					{...register("content")}
				/>
				{errors.content && (
					<FieldError>{errors.content.message}</FieldError>
				)}
			</Field>

			<div className="flex justify-end gap-2">
				<Button type="button" variant="ghost" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit" disabled={createMutation.isPending}>
					{createMutation.isPending
						? "Creating..."
						: "Create Discussion"}
				</Button>
			</div>
		</form>
	);
}
