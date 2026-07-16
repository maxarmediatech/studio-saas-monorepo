"use client";

import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { submissionsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

type ReviewClaimAction = "admin_release" | "reassign" | "release";

interface ReviewerOption {
	id: string;
	label: string;
}

interface ReviewClaimActionDialogProps {
	action: ReviewClaimAction;
	members?: ReviewerOption[];
	onOpenChange: (open: boolean) => void;
	open: boolean;
	submissionId: string;
}

const copy = {
	release: {
		title: "Release review claim",
		description: "Return this submission to the review queue immediately.",
		submit: "Release claim",
	},
	admin_release: {
		title: "Release stale claim",
		description:
			"Admin override: return this stale claim to the review queue. The reason is recorded.",
		submit: "Release stale claim",
	},
	reassign: {
		title: "Reassign stale claim",
		description:
			"Admin override: move this stale claim to another organization member. The reason is recorded.",
		submit: "Reassign claim",
	},
} satisfies Record<ReviewClaimAction, Record<string, string>>;

export function ReviewClaimActionDialog({
	action,
	members = [],
	onOpenChange,
	open,
	submissionId,
}: ReviewClaimActionDialogProps) {
	const queryClient = useQueryClient();
	const [reason, setReason] = useState("");
	const [reviewerId, setReviewerId] = useState("");
	const onSuccess = () => {
		toast.success("Review claim updated");
		queryClient.invalidateQueries({ queryKey: orpc.submissions.key() });
		queryClient.invalidateQueries({ queryKey: orpc.activities.key() });
		setReason("");
		setReviewerId("");
		onOpenChange(false);
	};
	const onError = (error: Error) =>
		toast.error(error.message || "Review claim action failed");
	const releaseMutation = useMutation({
		...submissionsMutations.release(),
		onSuccess,
		onError,
	});
	const adminReleaseMutation = useMutation({
		...submissionsMutations.adminRelease(),
		onSuccess,
		onError,
	});
	const reassignMutation = useMutation({
		...submissionsMutations.reassign(),
		onSuccess,
		onError,
	});
	const isPending =
		releaseMutation.isPending ||
		adminReleaseMutation.isPending ||
		reassignMutation.isPending;
	const canSubmit =
		reason.trim().length >= 3 &&
		(action !== "reassign" || reviewerId.length > 0);

	const submit = () => {
		const input = { id: submissionId, reason: reason.trim() };
		if (action === "release") {
			releaseMutation.mutate(input);
		}
		if (action === "admin_release") {
			adminReleaseMutation.mutate(input);
		}
		if (action === "reassign") {
			reassignMutation.mutate({ ...input, reviewerId });
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{copy[action].title}</DialogTitle>
					<DialogDescription>
						{copy[action].description}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					{action === "reassign" && (
						<div className="space-y-2">
							<label
								className="text-sm font-medium"
								htmlFor="reviewer"
							>
								New reviewer
							</label>
							<Select
								value={reviewerId}
								onValueChange={setReviewerId}
							>
								<SelectTrigger id="reviewer">
									<SelectValue placeholder="Select a member" />
								</SelectTrigger>
								<SelectContent>
									{members.map((member) => (
										<SelectItem
											key={member.id}
											value={member.id}
										>
											{member.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
					<div className="space-y-2">
						<label
							className="text-sm font-medium"
							htmlFor="claim-reason"
						>
							Reason
						</label>
						<Textarea
							id="claim-reason"
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder="Why is this claim being changed?"
							maxLength={500}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={submit} disabled={!canSubmit || isPending}>
						{isPending ? "Saving..." : copy[action].submit}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
