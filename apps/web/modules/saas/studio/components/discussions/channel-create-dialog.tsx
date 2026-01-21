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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { discussionsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const channelSchema = z.object({
	name: z.string().min(1, "Channel name is required").max(100),
	description: z.string().max(500).optional(),
	emoji: z.string().max(20).optional(),
	visibility: z.enum(["public", "private"]),
});

type ChannelFormValues = z.infer<typeof channelSchema>;

interface ChannelCreateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ChannelCreateDialog({
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
			emoji: "",
			visibility: "public",
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
			name: values.name,
			description: values.description || undefined,
			emoji: values.emoji || undefined,
			visibility: values.visibility,
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
					<div className="flex gap-3">
						<Field className="w-20">
							<FieldLabel>Emoji</FieldLabel>
							<Input
								placeholder="💬"
								maxLength={4}
								{...register("emoji")}
							/>
						</Field>

						<Field className="flex-1">
							<FieldLabel>Name</FieldLabel>
							<Input
								placeholder="general"
								{...register("name")}
							/>
							{errors.name && (
								<FieldError>{errors.name.message}</FieldError>
							)}
						</Field>
					</div>

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

					<Field>
						<FieldLabel>Visibility</FieldLabel>
						<Controller
							control={control}
							name="visibility"
							render={({ field }) => (
								<Select
									value={field.value}
									onValueChange={field.onChange}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="public">
											Public - Anyone in the organization
											can see
										</SelectItem>
										<SelectItem value="private">
											Private - Only invited members can
											see
										</SelectItem>
									</SelectContent>
								</Select>
							)}
						/>
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
