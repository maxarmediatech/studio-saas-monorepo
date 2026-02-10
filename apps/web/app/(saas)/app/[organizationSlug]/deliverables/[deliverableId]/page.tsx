"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { formatMoney } from "@saas/shared/lib";
import { SubmissionCard } from "@saas/studio/components/shared";
import { useDeliverableParams } from "@saas/studio/hooks/params";
import { deliverablesApi, submissionsApi } from "@saas/studio/lib/api";
import type {
	SubmissionStatus,
	WorkflowStatus,
} from "@saas/studio/lib/submission-status";
import { UserAvatar } from "@shared/components/UserAvatar";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
	CalendarIcon,
	CheckCircle2Icon,
	ChevronRight,
	CircleIcon,
	PackageIcon,
	PencilIcon,
	PlayCircleIcon,
	XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

function getStatusBadge(status: string) {
	const statusLower = status.toLowerCase();
	switch (statusLower) {
		case "completed":
		case "delivered":
			return (
				<Badge className="bg-green-500/10 text-green-600 border-green-500/20">
					<CheckCircle2Icon className="mr-1 h-3 w-3" />
					{status}
				</Badge>
			);
		case "in_progress":
			return (
				<Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
					<PlayCircleIcon className="mr-1 h-3 w-3" />
					In Progress
				</Badge>
			);
		case "pending":
			return (
				<Badge variant="secondary">
					<CircleIcon className="mr-1 h-3 w-3" />
					Pending
				</Badge>
			);
		case "cancelled":
			return (
				<Badge variant="outline">
					<XCircleIcon className="mr-1 h-3 w-3" />
					Cancelled
				</Badge>
			);
		default:
			return <Badge variant="outline">{status}</Badge>;
	}
}

function getWorkflowStatusBadge(status: WorkflowStatus) {
	switch (status) {
		case "not_started":
			return (
				<Badge variant="outline" className="text-muted-foreground">
					Not Started
				</Badge>
			);
		case "assigned":
			return (
				<Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
					Assigned
				</Badge>
			);
		case "submitted":
			return (
				<Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">
					Submitted
				</Badge>
			);
		case "in_review":
			return (
				<Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
					In Review
				</Badge>
			);
		case "revision_requested":
			return (
				<Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
					Revision Requested
				</Badge>
			);
		case "approved":
			return (
				<Badge className="bg-green-500/10 text-green-600 border-green-500/20">
					Approved
				</Badge>
			);
		default:
			return <Badge variant="outline">{status}</Badge>;
	}
}

export default function DeliverableDetailPage() {
	const params = useParams<{
		organizationSlug: string;
		deliverableId: string;
	}>();
	const { openEdit } = useDeliverableParams();

	const { data: deliverableData, isLoading: deliverableLoading } = useQuery(
		deliverablesApi.getOptions(params.deliverableId),
	);

	const deliverable = deliverableData?.data;

	const {
		data: submissionsData,
		isLoading: submissionsLoading,
		isError: submissionsError,
	} = useQuery({
		...submissionsApi.listOptions({
			deliverableId: params.deliverableId,
			sortBy: "submittedAt",
			sortDirection: "asc",
		}),
		enabled: !!params.deliverableId,
	});

	const submissions = submissionsData?.data ?? [];

	const submissionsByCrewId = useMemo(() => {
		const map = new Map<string, typeof submissions>();
		for (const submission of submissions) {
			const existing = map.get(submission.submittedBy) ?? [];
			existing.push(submission);
			map.set(submission.submittedBy, existing);
		}
		return map;
	}, [submissions]);

	const unassignedCrewSubmissions = useMemo(() => {
		if (!deliverable?.assignments) return submissions;
		const assignedCrewIds = new Set(
			deliverable.assignments.map((a) => a.crewId),
		);
		return submissions.filter((s) => !assignedCrewIds.has(s.submittedBy));
	}, [submissions, deliverable?.assignments]);

	const deliverablesHref = `/app/${params.organizationSlug}/deliverables`;

	if (deliverableLoading) {
		return (
			<div className="mx-auto w-full max-w-[800px] py-6 px-4">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="mt-8 h-8 w-96" />
				<Skeleton className="mt-4 h-4 w-64" />
				<Skeleton className="mt-6 h-24 w-full" />
			</div>
		);
	}

	if (!deliverable) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-muted-foreground">
					Deliverable not found
				</div>
			</div>
		);
	}

	const booking = deliverable.booking;

	return (
		<div className="mx-auto w-full max-w-[800px] py-6 px-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm">
					<Link
						href={deliverablesHref}
						className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
					>
						<PackageIcon className="size-4" />
						Deliverables
					</Link>
					<ChevronRight className="size-4 text-muted-foreground" />
					<span className="font-medium text-foreground truncate max-w-[300px]">
						{deliverable.name}
					</span>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => openEdit(deliverable.id)}
				>
					<PencilIcon className="mr-1 size-4" />
					Edit
				</Button>
			</div>

			<div className="mt-8">
				<h1 className="text-2xl font-semibold">{deliverable.name}</h1>
				<div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
					<span>in</span>
					<Link
						href={`/app/${params.organizationSlug}/bookings/${booking.id}`}
						className="font-medium text-foreground hover:underline"
					>
						{booking.name}
					</Link>
					{deliverable.dueDate && (
						<>
							<span>·</span>
							<span className="flex items-center gap-1">
								<CalendarIcon className="size-3" />
								Due{" "}
								{format(
									new Date(deliverable.dueDate),
									"MMM d, yyyy",
								)}
							</span>
						</>
					)}
					<span>·</span>
					<span>
						Created{" "}
						{format(new Date(deliverable.createdAt), "MMM d, yyyy")}
					</span>
				</div>

				<div className="mt-4 flex flex-wrap items-center gap-2">
					{getStatusBadge(deliverable.status)}
					{getWorkflowStatusBadge(deliverable.workflowStatus)}
					{deliverable.isPackageIncluded && (
						<Badge
							variant="outline"
							className="text-muted-foreground"
						>
							Package Included
						</Badge>
					)}
					{deliverable.quantity > 1 && (
						<Badge
							variant="outline"
							className="text-muted-foreground"
						>
							Qty: {deliverable.quantity}
						</Badge>
					)}
					{deliverable.cost && (
						<Badge
							variant="outline"
							className="text-muted-foreground"
						>
							{formatMoney(deliverable.cost)}
						</Badge>
					)}
				</div>

				{deliverable.deliveredAt && (
					<div className="mt-4 flex items-center gap-2 text-sm text-green-600">
						<CheckCircle2Icon className="size-4" />
						Delivered on{" "}
						{format(
							new Date(deliverable.deliveredAt),
							"MMM d, yyyy",
						)}
					</div>
				)}

				{deliverable.description && (
					<p className="mt-6 text-foreground whitespace-pre-wrap">
						{deliverable.description}
					</p>
				)}

				{deliverable.assignments &&
					deliverable.assignments.length > 0 && (
						<div className="mt-4 flex flex-wrap gap-2">
							{deliverable.assignments.map((assignment) => (
								<Badge
									key={assignment.id}
									variant="secondary"
									className={cn(
										"flex items-center gap-1.5",
										assignment.isLead &&
											"ring-1 ring-primary/50",
									)}
								>
									<UserAvatar
										name={assignment.crew.name}
										className="size-4"
									/>
									<span>{assignment.crew.name}</span>
									{assignment.isLead && (
										<span className="text-xs text-primary">
											Lead
										</span>
									)}
								</Badge>
							))}
						</div>
					)}
			</div>

			<div className="mt-8 border-t pt-6">
				<h2 className="font-semibold">Activity</h2>

				{submissionsLoading && (
					<div className="mt-4 space-y-4">
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-20 w-full" />
					</div>
				)}

				{submissionsError && (
					<div className="mt-4 text-sm text-destructive">
						Failed to load submissions
					</div>
				)}

				{!submissionsLoading && !submissionsError && (
					<div className="mt-4 relative">
						{(deliverable.assignments?.length > 0 ||
							submissions.length > 0) && (
							<div
								className="absolute w-px bg-border/60"
								style={{
									left: "9px",
									top: "20px",
									bottom: "0",
								}}
							/>
						)}

						<div className="space-y-6">
							{deliverable.assignments &&
							deliverable.assignments.length > 0 ? (
								deliverable.assignments.map((assignment) => {
									const crewSubmissions =
										submissionsByCrewId.get(
											assignment.crewId,
										) ?? [];

									return (
										<div
											key={assignment.id}
											className="space-y-4"
										>
											<div className="flex items-center gap-2 text-sm text-muted-foreground">
												<UserAvatar
													name={assignment.crew.name}
													className="size-5"
												/>
												<span className="font-medium text-foreground">
													{assignment.crew.name}
												</span>
												<span>assigned</span>
												{assignment.isLead && (
													<Badge
														variant="outline"
														className="text-xs"
													>
														Lead
													</Badge>
												)}
												<span>·</span>
												<span>
													{formatDistanceToNow(
														new Date(
															assignment.createdAt,
														),
														{ addSuffix: true },
													)}
												</span>
											</div>

											{crewSubmissions.length > 0 ? (
												<div className="ml-7 space-y-3">
													{crewSubmissions.map(
														(submission) => (
															<SubmissionCard
																key={
																	submission.id
																}
																submission={{
																	...submission,
																	status: submission.status as SubmissionStatus,
																}}
															/>
														),
													)}
												</div>
											) : (
												<div className="ml-7 text-sm text-muted-foreground italic">
													No submissions yet
												</div>
											)}
										</div>
									);
								})
							) : submissions.length > 0 ? (
								<div className="space-y-4">
									<div className="text-sm text-muted-foreground">
										Submissions from unassigned crew:
									</div>
									<div className="ml-7 space-y-3">
										{submissions.map((submission) => (
											<SubmissionCard
												key={submission.id}
												submission={{
													...submission,
													status: submission.status as SubmissionStatus,
												}}
											/>
										))}
									</div>
								</div>
							) : (
								<div className="text-sm text-muted-foreground py-4">
									No crew assigned to this deliverable yet.
								</div>
							)}

							{deliverable.assignments &&
								deliverable.assignments.length > 0 &&
								unassignedCrewSubmissions.length > 0 && (
									<div className="space-y-4">
										<div className="text-sm text-muted-foreground">
											Submissions from unassigned crew:
										</div>
										<div className="ml-7 space-y-3">
											{unassignedCrewSubmissions.map(
												(submission) => (
													<SubmissionCard
														key={submission.id}
														submission={{
															...submission,
															status: submission.status as SubmissionStatus,
														}}
													/>
												),
											)}
										</div>
									</div>
								)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
