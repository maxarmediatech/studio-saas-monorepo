"use client";

import { UserAvatar } from "@shared/components/UserAvatar";
import { formatDistanceToNow } from "date-fns";
import {
	CheckCircle2Icon,
	CircleIcon,
	ExternalLinkIcon,
	FileTextIcon,
	PlayCircleIcon,
	RotateCcwIcon,
	XCircleIcon,
} from "lucide-react";
import {
	getSubmissionStatusLabel,
	type SubmissionStatus,
} from "../../lib/submission-status";

function getSubmissionStatusIcon(status: SubmissionStatus) {
	switch (status) {
		case "approved":
			return <CheckCircle2Icon className="size-4 text-green-600" />;
		case "rejected":
			return <XCircleIcon className="size-4 text-red-600" />;
		case "revision_requested":
			return <RotateCcwIcon className="size-4 text-amber-600" />;
		case "in_review":
			return <PlayCircleIcon className="size-4 text-orange-600" />;
		case "submitted":
			return <FileTextIcon className="size-4 text-purple-600" />;
		default:
			return <CircleIcon className="size-4 text-muted-foreground" />;
	}
}

export interface SubmissionCardData {
	id: string;
	status: SubmissionStatus;
	submissionNote: string | null;
	submissionLinks: string[] | null;
	submittedAt: string | null;
	submittedByName: string;
	submittedByRole: string;
	reviewedBy: string | null;
	reviewedByName: string | null;
	reviewedAt: string | null;
	reviewNote: string | null;
}

interface SubmissionCardProps {
	submission: SubmissionCardData;
}

export function SubmissionCard({ submission }: SubmissionCardProps) {
	const hasReview =
		submission.reviewedAt &&
		submission.status !== "submitted" &&
		submission.status !== "draft";

	return (
		<div className="rounded-lg border bg-card">
			<div className="p-4">
				<div className="flex items-start gap-3">
					<UserAvatar
						name={submission.submittedByName}
						className="size-8"
					/>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<span className="font-medium text-sm">
								{submission.submittedByName}
							</span>
							<span className="text-xs text-muted-foreground">
								({submission.submittedByRole})
							</span>
							<span className="text-xs text-muted-foreground">
								submitted
							</span>
							{submission.submittedAt && (
								<span className="text-xs text-muted-foreground">
									{formatDistanceToNow(
										new Date(submission.submittedAt),
										{ addSuffix: true },
									)}
								</span>
							)}
						</div>
						{submission.submissionNote && (
							<p className="mt-1 text-sm text-foreground">
								{submission.submissionNote}
							</p>
						)}
						{submission.submissionLinks &&
							submission.submissionLinks.length > 0 && (
								<div className="mt-2 flex flex-wrap gap-2">
									{submission.submissionLinks.map(
										(link, i) => (
											<a
												key={i}
												href={link}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
											>
												<ExternalLinkIcon className="size-3" />
												Link {i + 1}
											</a>
										),
									)}
								</div>
							)}
					</div>
				</div>
			</div>

			{hasReview && (
				<div className="border-t bg-muted/30 p-4">
					<div className="flex items-start gap-3">
						<div className="flex size-8 items-center justify-center">
							{getSubmissionStatusIcon(submission.status)}
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<span className="font-medium text-sm">
									{submission.reviewedByName ?? "Reviewer"}
								</span>
								<span className="text-xs text-muted-foreground">
									{getSubmissionStatusLabel(
										submission.status,
									)}
								</span>
								{submission.reviewedAt && (
									<span className="text-xs text-muted-foreground">
										{formatDistanceToNow(
											new Date(submission.reviewedAt),
											{ addSuffix: true },
										)}
									</span>
								)}
							</div>
							{submission.reviewNote && (
								<p className="mt-1 text-sm text-foreground">
									{submission.reviewNote}
								</p>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
