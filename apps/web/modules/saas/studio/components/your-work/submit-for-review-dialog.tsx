"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type {
	YourWorkEntityType,
	YourWorkItem,
} from "@repo/api/modules/studio/schemas/your-work";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { orpc } from "@shared/lib/orpc-query-utils";
import { orpcClient } from "@shared/lib/orpc-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const submissionSchema = z.object({
	submissionNote: z.string().max(5000).optional(),
});

type SubmissionFormValues = z.infer<typeof submissionSchema>;

type SubmissionAttachment = {
	name: string;
	size: number;
	type: string;
	key: string;
	url: string;
};

interface SubmitForReviewDialogProps {
	item: YourWorkItem | null;
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}

function formatFileSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getEntityLabel(entityType: YourWorkEntityType) {
	switch (entityType) {
		case "task":
			return "Task";
		case "deliverable":
			return "Deliverable";
		default:
			return "Item";
	}
}

export function SubmitForReviewDialog({
	item,
	isOpen,
	onOpenChange,
}: SubmitForReviewDialogProps) {
	const queryClient = useQueryClient();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [attachments, setAttachments] = useState<SubmissionAttachment[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [deletingKey, setDeletingKey] = useState<string | null>(null);

	const form = useForm<SubmissionFormValues>({
		resolver: zodResolver(submissionSchema),
		defaultValues: {
			submissionNote: "",
		},
	});

	useEffect(() => {
		if (!isOpen) {
			form.reset();
			setAttachments([]);
			setDeletingKey(null);
		}
	}, [form, isOpen]);

	const submitMutation = useMutation({
		mutationFn: async (values: SubmissionFormValues) => {
			if (!item) {
				throw new Error("No submission target selected");
			}

			const payload = {
				submissionNote: values.submissionNote?.trim() || undefined,
				files: attachments.length > 0 ? attachments : undefined,
			};

			if (item.entityType === "task") {
				return orpcClient.tasks.submit({
					taskId: item.entityId,
					...payload,
				});
			}

			return orpcClient.deliverables.submit({
				deliverableId: item.entityId,
				...payload,
			});
		},
		onSuccess: () => {
			toast.success("Submission sent for review");
			queryClient.invalidateQueries({ queryKey: orpc.yourWork.key() });
			queryClient.invalidateQueries({ queryKey: orpc.submissions.key() });
			if (item?.entityType === "task") {
				queryClient.invalidateQueries({ queryKey: orpc.tasks.key() });
			}
			if (item?.entityType === "deliverable") {
				queryClient.invalidateQueries({
					queryKey: orpc.deliverables.key(),
				});
			}
			form.reset();
			setAttachments([]);
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to submit for review");
		},
	});

	const isSubmitting = submitMutation.isPending;

	const handleUploadFiles = async (files: File[]) => {
		setIsUploading(true);
		try {
			const uploaded: SubmissionAttachment[] = [];
			for (const file of files) {
				const presignedUrlRes = await fetch(
					"/api/uploads/presigned-url",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							fileName: file.name,
							fileType: file.type,
							fileSize: file.size,
							context: "deliverables",
						}),
					},
				);

				if (!presignedUrlRes.ok) {
					const error = await presignedUrlRes.json();
					throw new Error(
						error.message || "Failed to get upload URL",
					);
				}

				const { url, key } = await presignedUrlRes.json();

				const uploadRes = await fetch(url, {
					method: "PUT",
					body: file,
					headers: { "Content-Type": file.type },
				});

				if (!uploadRes.ok) {
					throw new Error("Upload failed");
				}

				const finalUrl = url.split("?")[0];
				uploaded.push({
					name: file.name,
					size: file.size,
					type: file.type,
					key,
					url: finalUrl,
				});
			}

			setAttachments((prev) => [...prev, ...uploaded]);
			if (uploaded.length > 0) {
				toast.success("Files uploaded");
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Upload failed";
			toast.error(message);
		} finally {
			setIsUploading(false);
		}
	};

	const handleFileInput = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const files = Array.from(event.target.files ?? []);
		if (files.length === 0) {
			return;
		}

		await handleUploadFiles(files);
		event.target.value = "";
	};

	const handleRemoveAttachment = async (attachment: SubmissionAttachment) => {
		setDeletingKey(attachment.key);
		try {
			const deleteRes = await fetch("/api/uploads/file", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: attachment.key }),
			});
			if (!deleteRes.ok) {
				throw new Error("Delete failed");
			}
			setAttachments((prev) =>
				prev.filter((file) => file.key !== attachment.key),
			);
			toast.success("File removed");
		} catch {
			toast.error("Failed to remove file");
		} finally {
			setDeletingKey(null);
		}
	};

	const dialogTitle = useMemo(() => {
		if (!item) {
			return "Submit for review";
		}
		return `Submit ${getEntityLabel(item.entityType)} for review`;
	}, [item]);

	if (!item) {
		return null;
	}

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{dialogTitle}</DialogTitle>
				</DialogHeader>

				<div className="space-y-2 text-sm text-muted-foreground">
					<p className="font-medium text-foreground">{item.name}</p>
					{item.bookingName && <p>Booking: {item.bookingName}</p>}
				</div>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit((values) =>
							submitMutation.mutate(values),
						)}
						className="space-y-6"
					>
						<FormField
							control={form.control}
							name="submissionNote"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Submission note</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Share context or a link to proof of work..."
											className="min-h-[120px]"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<FormLabel className="text-sm font-medium">
									Attachments
								</FormLabel>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => fileInputRef.current?.click()}
									disabled={isUploading}
								>
									{isUploading ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<Paperclip className="mr-2 h-4 w-4" />
									)}
									Upload files
								</Button>
								<input
									ref={fileInputRef}
									type="file"
									multiple
									className="hidden"
									onChange={handleFileInput}
								/>
							</div>

							{attachments.length === 0 ? (
								<p className="text-xs text-muted-foreground">
									No files uploaded.
								</p>
							) : (
								<div className="space-y-2">
									{attachments.map((attachment) => (
										<div
											key={attachment.key}
											className="flex items-center justify-between rounded-md border border-border p-2"
										>
											<div className="flex min-w-0 items-center gap-2">
												<FileText className="h-4 w-4 text-muted-foreground" />
												<div className="min-w-0">
													<p className="truncate text-sm font-medium">
														{attachment.name}
													</p>
													<p className="text-xs text-muted-foreground">
														{formatFileSize(attachment.size)}
													</p>
												</div>
											</div>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() =>
													handleRemoveAttachment(attachment)
												}
												disabled={
													deletingKey === attachment.key
												}
											>
												{deletingKey === attachment.key ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<Trash2 className="h-4 w-4" />
												)}
											</Button>
										</div>
									))}
								</div>
							)}
						</div>

						<DialogFooter className="gap-2">
							<Button
								type="button"
								variant="ghost"
								onClick={() => onOpenChange(false)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={isSubmitting || isUploading}
							>
								{isSubmitting ? "Submitting..." : "Submit"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
