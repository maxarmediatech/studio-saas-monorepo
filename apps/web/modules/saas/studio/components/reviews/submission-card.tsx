"use client";

import type { SubmissionListItem } from "@repo/api/modules/studio/schemas/submission";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { useSession } from "@saas/auth/hooks/use-session";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { submissionsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
	CheckCircle,
	Clock,
	RotateCcw,
	ThumbsUp,
	UserPlus,
	UserRoundCog,
	XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ReviewClaimActionDialog } from "./review-claim-action-dialog";
import { ReviewSubmissionDialog } from "./review-submission-dialog";

const STATUS_CONFIG = {
	submitted: {
		label: "Ready for review",
		className: "bg-amber-50 text-amber-700",
		icon: Clock,
	},
	in_review: {
		label: "In review",
		className: "bg-blue-50 text-blue-700",
		icon: Clock,
	},
	revision_requested: {
		label: "Changes requested",
		className: "bg-orange-50 text-orange-700",
		icon: Clock,
	},
	approved: {
		label: "Approved",
		className: "bg-emerald-50 text-emerald-700",
		icon: CheckCircle,
	},
	rejected: {
		label: "Rejected",
		className: "bg-red-50 text-red-700",
		icon: XCircle,
	},
	draft: {
		label: "Draft",
		className: "bg-muted text-muted-foreground",
		icon: Clock,
	},
} as const;

interface SubmissionCardProps {
	submission: SubmissionListItem;
}

export function SubmissionCard({ submission }: SubmissionCardProps) {
	const { user } = useSession();
	const { activeOrganization, isOrganizationAdmin } = useActiveOrganization();
	const queryClient = useQueryClient();
	const [isReviewOpen, setIsReviewOpen] = useState(false);
	const [claimAction, setClaimAction] = useState<
		"admin_release" | "reassign" | "release" | null
	>(null);

	const isAssignedToMe = submission.reviewedBy === user?.id;
	const canClaim =
		submission.status === "submitted" && !submission.reviewedBy;
	const canReview = submission.status === "in_review" && isAssignedToMe;
	const isStaleClaim =
		submission.status === "in_review" &&
		!!submission.reviewClaimStaleAt &&
		new Date(submission.reviewClaimStaleAt).getTime() <= Date.now();
	const reviewerOptions = useMemo(
		() =>
			activeOrganization?.members
				.filter((member) => member.userId !== submission.reviewedBy)
				.map((member) => ({
					id: member.userId,
					label:
						member.user?.name ??
						member.user?.email ??
						"Organization member",
				})) ?? [],
		[activeOrganization?.members, submission.reviewedBy],
	);

	const statusConfig =
		STATUS_CONFIG[submission.status as keyof typeof STATUS_CONFIG];
	const StatusIcon = statusConfig?.icon ?? Clock;

	const submittedAtLabel = useMemo(() => {
		if (!submission.submittedAt) {
			return "Unknown submission time";
		}

		return formatDistanceToNow(new Date(submission.submittedAt), {
			addSuffix: true,
		});
	}, [submission.submittedAt]);
	const claimedAtLabel = useMemo(() => {
		if (!submission.reviewClaimedAt) {
			return null;
		}
		return formatDistanceToNow(new Date(submission.reviewClaimedAt), {
			addSuffix: true,
		});
	}, [submission.reviewClaimedAt]);

	const claimMutation = useMutation({
		...submissionsMutations.claim(),
		onSuccess: () => {
			toast.success("Submission claimed");
			queryClient.invalidateQueries({
				queryKey: orpc.submissions.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to claim submission");
		},
	});

	return (
		<>
			<Card className="transition-shadow hover:shadow-sm">
				<CardHeader>
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="space-y-2">
							<Badge variant="secondary">
								{submission.entityType === "task"
									? "Task"
									: "Deliverable"}
							</Badge>
							<CardTitle className="text-lg">
								{submission.entityName}
							</CardTitle>
							<p className="text-sm text-muted-foreground">
								Booking: {submission.bookingName}
								{submission.bookingReferenceNumber
									? ` · ${submission.bookingReferenceNumber}`
									: ""}
							</p>
						</div>
						<div className="flex items-center gap-3 text-sm">
							<Avatar className="h-8 w-8">
								<AvatarFallback>
									{submission.submittedByName
										?.charAt(0)
										.toUpperCase() ?? "?"}
								</AvatarFallback>
							</Avatar>
							<div>
								<p className="font-medium">
									{submission.submittedByName}
								</p>
								<p className="text-xs text-muted-foreground">
									{submittedAtLabel}
								</p>
							</div>
						</div>
					</div>
				</CardHeader>

				{submission.submissionNote && (
					<CardContent>
						<p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground/80">
							{submission.submissionNote}
						</p>
					</CardContent>
				)}

				<CardFooter className="flex flex-wrap items-center justify-between gap-3 bg-muted/40">
					<div className="flex flex-wrap items-center gap-2 text-xs">
						<div
							className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
								statusConfig?.className ??
								"bg-muted text-muted-foreground"
							}`}
						>
							<StatusIcon className="h-3.5 w-3.5" />
							{statusConfig?.label ?? submission.status}
						</div>
						{submission.reviewedByName ? (
							<div className="text-muted-foreground">
								{submission.status === "in_review"
									? "Assigned to"
									: "Reviewed by"}{" "}
								<span className="font-semibold text-foreground">
									{isAssignedToMe
										? "You"
										: submission.reviewedByName}
								</span>
								{submission.status === "in_review" &&
									claimedAtLabel && (
										<span className="ml-1">
											· claimed {claimedAtLabel}
											{isStaleClaim ? " · stale" : ""}
										</span>
									)}
							</div>
						) : submission.status === "submitted" ? (
							<p className="text-amber-600">Unassigned</p>
						) : null}
					</div>

					<div className="flex flex-wrap gap-2">
						{canClaim && (
							<Button
								size="sm"
								variant="outline"
								onClick={() =>
									claimMutation.mutate({ id: submission.id })
								}
								disabled={claimMutation.isPending}
							>
								<UserPlus className="mr-2 h-4 w-4" />
								{claimMutation.isPending
									? "Claiming..."
									: "Claim"}
							</Button>
						)}
						{canReview && (
							<>
								<Button
									size="sm"
									variant="outline"
									onClick={() => setClaimAction("release")}
								>
									<RotateCcw className="mr-2 h-4 w-4" />
									Release
								</Button>
								<Button
									size="sm"
									variant="default"
									onClick={() => setIsReviewOpen(true)}
								>
									<ThumbsUp className="mr-2 h-4 w-4" />
									Review
								</Button>
							</>
						)}
						{isOrganizationAdmin && isStaleClaim && (
							<>
								{!isAssignedToMe && (
									<Button
										size="sm"
										variant="outline"
										onClick={() =>
											setClaimAction("admin_release")
										}
									>
										<RotateCcw className="mr-2 h-4 w-4" />
										Admin release
									</Button>
								)}
								<Button
									size="sm"
									variant="outline"
									onClick={() => setClaimAction("reassign")}
								>
									<UserRoundCog className="mr-2 h-4 w-4" />
									Reassign
								</Button>
							</>
						)}
					</div>
				</CardFooter>
			</Card>

			<ReviewSubmissionDialog
				submissionId={submission.id}
				isOpen={isReviewOpen}
				onOpenChange={setIsReviewOpen}
			/>
			{claimAction && (
				<ReviewClaimActionDialog
					action={claimAction}
					members={reviewerOptions}
					onOpenChange={(open) => !open && setClaimAction(null)}
					open
					submissionId={submission.id}
				/>
			)}
		</>
	);
}
