"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/button";
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
import { Textarea } from "@repo/ui/components/textarea";
import { discussionsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const channelSchema = z.object({
	name: z.string().min(1, "Channel name is required").max(100),
	description: z.string().max(500).optional(),
});

type ChannelFormValues = z.infer<typeof channelSchema>;

interface ChannelCreateDialogProps {
	organizationSlug: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ChannelCreateDialog({
	organizationSlug,
	open,
	onOpenChange,
}: ChannelCreateDialogProps) {
	const queryClient = useQueryClient();

	const {
		register,
		handleSubmit,
		reset,
		control,
		formState: { errors },
	} = useForm<ChannelFormValues>({
		resolver: zodResolver(channelSchema),
		defaultValues: {
			name: "",
			description: "",
		},
	});

	useEffect(() => {
		if (!open) {
			reset();
		}
	}, [open, reset]);

	const createMutation = useMutation({
		...discussionsMutations.createChannel(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.discussions.listChannels.key(),
			});
			toast.success("Channel created");
			onOpenChange(false);
		},
		onError: () => {
			toast.error("Failed to create channel");
		},
	});

	const onSubmit = (values: ChannelFormValues) => {
		createMutation.mutate({
			organizationSlug,
			name: values.name,
			description: values.description || undefined,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle>Create Channel</DialogTitle>
					<DialogDescription>
						Create a new channel for team discussions.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<Field>
						<FieldLabel>Name</FieldLabel>
						<Input placeholder="general" {...register("name")} />
						{errors.name && (
							<FieldError>{errors.name.message}</FieldError>
						)}
					</Field>

					<Field>
						<FieldLabel>Description (optional)</FieldLabel>
						<Textarea
							placeholder="What's this channel about?"
							rows={2}
							{...register("description")}
						/>
						{errors.description && (
							<FieldError>
								{errors.description.message}
							</FieldError>
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
						<Button
							type="submit"
							disabled={createMutation.isPending}
						>
							{createMutation.isPending
								? "Creating..."
								: "Create Channel"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
