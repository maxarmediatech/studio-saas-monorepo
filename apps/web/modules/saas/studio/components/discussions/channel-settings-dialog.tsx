"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
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
import { Separator } from "@repo/ui/components/separator";
import { Textarea } from "@repo/ui/components/textarea";
import { discussionsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const channelSchema = z.object({
	name: z.string().min(1, "Channel name is required").max(100),
	description: z.string().max(500).optional(),
});

type ChannelFormValues = z.infer<typeof channelSchema>;

interface ChannelSettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	channel: {
		id: string;
		name: string;
		slug: string;
		description?: string | null;
	};
	organizationSlug: string;
}

export function ChannelSettingsDialog({
	open,
	onOpenChange,
	channel,
	organizationSlug,
}: ChannelSettingsDialogProps) {
	const queryClient = useQueryClient();
	const router = useRouter();
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isDirty },
	} = useForm<ChannelFormValues>({
		resolver: zodResolver(channelSchema),
		defaultValues: {
			name: channel.name,
			description: channel.description ?? "",
		},
	});

	useEffect(() => {
		if (open) {
			reset({
				name: channel.name,
				description: channel.description ?? "",
			});
		}
	}, [open, channel, reset]);

	const updateMutation = useMutation({
		...discussionsMutations.updateChannel(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.discussions.listChannels.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.discussions.getChannelBySlug.key(),
			});
			toast.success("Channel updated");
			onOpenChange(false);
		},
		onError: () => {
			toast.error("Failed to update channel");
		},
	});

	const deleteMutation = useMutation({
		...discussionsMutations.deleteChannel(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.discussions.listChannels.key(),
			});
			toast.success("Channel deleted");
			onOpenChange(false);
			router.push(`/app/${organizationSlug}/discussions`);
		},
		onError: () => {
			toast.error("Failed to delete channel");
		},
	});

	const onSubmit = (values: ChannelFormValues) => {
		updateMutation.mutate({
			organizationSlug,
			channelId: channel.id,
			name: values.name,
			description: values.description || undefined,
		});
	};

	const handleDelete = () => {
		deleteMutation.mutate({ organizationSlug, channelId: channel.id });
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-[480px]">
					<DialogHeader>
						<DialogTitle>Channel Settings</DialogTitle>
						<DialogDescription>
							Update channel details or delete the channel.
						</DialogDescription>
					</DialogHeader>

					<form
						onSubmit={handleSubmit(onSubmit)}
						className="space-y-4"
					>
						<Field>
							<FieldLabel>Name</FieldLabel>
							<Input
								placeholder="general"
								{...register("name")}
							/>
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
								disabled={updateMutation.isPending || !isDirty}
							>
								{updateMutation.isPending
									? "Saving..."
									: "Save Changes"}
							</Button>
						</DialogFooter>
					</form>

					<Separator className="my-2" />

					<div className="space-y-2">
						<h4 className="text-sm font-medium text-destructive">
							Danger Zone
						</h4>
						<p className="text-sm text-muted-foreground">
							Deleting a channel will permanently remove all
							discussions and messages within it.
						</p>
						<Button
							variant="destructive"
							size="sm"
							onClick={() => setShowDeleteConfirm(true)}
						>
							Delete Channel
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={showDeleteConfirm}
				onOpenChange={setShowDeleteConfirm}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Channel?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the channel "
							{channel.name}" and all its discussions. This action
							cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleteMutation.isPending
								? "Deleting..."
								: "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
