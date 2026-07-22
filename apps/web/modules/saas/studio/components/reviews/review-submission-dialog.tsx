"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { SubmissionDetail } from "@repo/api/modules/studio/schemas/submission";
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
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import { Separator } from "@repo/ui/components/separator";
import { Textarea } from "@repo/ui/components/textarea";
import { submissionsApi, submissionsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const reviewSchema = z.object({
	decision: z.enum(["approve", "request_revision", "reject"], {
		message: "Select a review action.",
	}),
	reviewNote: z.string().max(5000).optional(),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface ReviewSubmissionDialogProps {
	submissionId: string;
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}

interface FileAccessResponse {
	method: "proxy" | "stream" | "redirect";
	url: string;
	filename?: string;
	expiresAt?: string;
}

export function ReviewSubmissionDialog({
	submissionId,
	isOpen,
	onOpenChange,
}: ReviewSubmissionDialogProps) {
	const queryClient = useQueryClient();
	const [loadingFileId, setLoadingFileId] = useState<string | null>(null);

	const form = useForm<ReviewFormData>({
		resolver: zodResolver(reviewSchema),
		defaultValues: {
			decision: "approve",
			reviewNote: "",
		},
	});

	const submissionQuery = useQuery({
		...submissionsApi.getOptions(submissionId),
		enabled: isOpen,
	});

	const submission = submissionQuery.data?.data as
		| SubmissionDetail
		| undefined;

	const reviewMutation = useMutation({
		...submissionsMutations.review(),
		onSuccess: () => {
			toast.success("Review submitted");
			queryClient.invalidateQueries({ queryKey: orpc.submissions.key() });
			queryClient.invalidateQueries({ queryKey: orpc.activities.key() });
			queryClient.invalidateQueries({ queryKey: orpc.yourWork.key() });
			form.reset();
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to submit review");
		},
	});

	const submitDisabled =
		reviewMutation.isPending || submissionQuery.isLoading;

	useEffect(() => {
		if (!isOpen) {
			form.reset();
		}
	}, [form, isOpen]);

	const onSubmit = (data: ReviewFormData) => {
		reviewMutation.mutate({
			id: submissionId,
			decision: data.decision,
			reviewNote: data.reviewNote || undefined,
		});
	};

	const fileList = useMemo(
		() => submission?.files ?? [],
		[submission?.files],
	);
	const linkList = useMemo(
		() => submission?.submissionLinks ?? [],
		[submission?.submissionLinks],
	);

	const handleFileOpen = async (fileId: string) => {
		setLoadingFileId(fileId);
		try {
			const res = await fetch("/api/files/access", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fileId, intent: "view" }),
			});

			if (!res.ok) {
				throw new Error("Unable to access file");
			}

			const payload = (await res.json()) as FileAccessResponse;
			window.open(payload.url, "_blank", "noopener,noreferrer");
		} catch (error) {
			toast.error("Failed to open file");
		} finally {
			setLoadingFileId(null);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Review Submission</DialogTitle>
				</DialogHeader>

				{submissionQuery.isLoading && (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading submission details...
					</div>
				)}

				{submission && (
					<div className="space-y-4">
						<div className="space-y-2 text-sm">
							<div>
								<p className="text-xs text-muted-foreground">
									Submission
								</p>
								<p className="font-medium">
									{submission.entityName}
								</p>
								{submission.entityDescription && (
									<p className="text-xs text-muted-foreground">
										{submission.entityDescription}
									</p>
								)}
							</div>
							<div>
								<p className="text-xs text-muted-foreground">
									Booking
								</p>
								<p className="font-medium">
									{submission.booking.name}
									{submission.booking.referenceNumber
										? ` · ${submission.booking.referenceNumber}`
										: ""}
								</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">
									Submitted by
								</p>
								<p className="font-medium">
									{submission.submittedByCrew.name}
								</p>
							</div>
						</div>

						{submission.submissionNote && (
							<div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground/80">
								{submission.submissionNote}
							</div>
						)}

						{linkList.length > 0 && (
							<div className="space-y-2">
								<p className="text-sm font-medium">Links</p>
								<div className="space-y-2">
									{linkList.map((link) => (
										<a
											key={link}
											href={link}
											target="_blank"
											rel="noreferrer"
											className="block truncate text-sm text-primary hover:underline"
										>
											{link}
										</a>
									))}
								</div>
							</div>
						)}

						{fileList.length > 0 && (
							<div className="space-y-2">
								<p className="text-sm font-medium">Files</p>
								<div className="space-y-2">
									{fileList.map((file) => (
										<button
											type="button"
											key={file.id}
											onClick={() =>
												handleFileOpen(file.id)
											}
											disabled={loadingFileId === file.id}
											className="flex w-full items-center gap-2 text-left text-sm text-primary hover:underline disabled:opacity-60"
										>
											{loadingFileId === file.id ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<FileText className="h-4 w-4" />
											)}
											<span className="truncate">
												{file.fileName}
											</span>
										</button>
									))}
								</div>
							</div>
						)}
					</div>
				)}

				<Separator />

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-6"
					>
						<FormField
							control={form.control}
							name="decision"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Decision</FormLabel>
									<FormControl>
										<RadioGroup
											onValueChange={field.onChange}
											defaultValue={field.value}
											className="flex flex-wrap gap-4"
										>
											<FormItem className="flex items-center space-x-2">
												<FormControl>
													<RadioGroupItem value="approve" />
												</FormControl>
												<FormLabel className="font-normal">
													Approve
												</FormLabel>
											</FormItem>
											<FormItem className="flex items-center space-x-2">
												<FormControl>
													<RadioGroupItem value="request_revision" />
												</FormControl>
												<FormLabel className="font-normal">
													Request Changes
												</FormLabel>
											</FormItem>
											<FormItem className="flex items-center space-x-2">
												<FormControl>
													<RadioGroupItem value="reject" />
												</FormControl>
												<FormLabel className="font-normal">
													Reject
												</FormLabel>
											</FormItem>
										</RadioGroup>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="reviewNote"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Feedback</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Share feedback for the crew member..."
											className="min-h-[120px]"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter className="gap-2">
							<Button
								type="button"
								variant="ghost"
								onClick={() => onOpenChange(false)}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={submitDisabled}>
								{reviewMutation.isPending
									? "Submitting..."
									: "Submit Review"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
