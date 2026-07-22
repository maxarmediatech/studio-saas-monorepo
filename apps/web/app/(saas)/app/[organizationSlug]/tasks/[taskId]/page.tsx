"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { SubmissionCard } from "@saas/studio/components/shared";
import { useStudioCapabilities } from "@saas/studio/components/studio-capabilities-context";
import { useTaskParams } from "@saas/studio/hooks/params/use-task-params";
import { submissionsApi, tasksApi } from "@saas/studio/lib/api";
import type {
	SubmissionStatus,
	WorkflowStatus,
} from "@saas/studio/lib/submission-status";
import { UserAvatar } from "@shared/components/UserAvatar";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
	AlertTriangleIcon,
	CalendarIcon,
	CheckCircle2Icon,
	ChevronRight,
	CircleIcon,
	ClipboardListIcon,
	PackageIcon,
	PencilIcon,
	PlayCircleIcon,
	XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

function getConvertedFromDeliverable(metadata: Record<string, unknown> | null) {
	const idValue = metadata?.convertedFromDeliverableId;
	const nameValue = metadata?.convertedFromDeliverableName;

	const deliverableId =
		typeof idValue === "string" && idValue.trim().length > 0
			? idValue.trim()
			: null;
	const deliverableName =
		typeof nameValue === "string" && nameValue.trim().length > 0
			? nameValue.trim()
			: null;

	return { deliverableId, deliverableName };
}

function getStatusBadge(status: string) {
	const statusLower = status.toLowerCase();
	switch (statusLower) {
		case "completed":
			return (
				<Badge className="bg-green-500/10 text-green-600 border-green-500/20">
					<CheckCircle2Icon className="mr-1 h-3 w-3" />
					Completed
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

function getPriorityBadge(priority: string) {
	const priorityLower = priority.toLowerCase();
	switch (priorityLower) {
		case "high":
			return (
				<Badge variant="destructive">
					<AlertTriangleIcon className="mr-1 h-3 w-3" />
					High
				</Badge>
			);
		case "medium":
			return (
				<Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
					Medium
				</Badge>
			);
		case "low":
			return <Badge variant="secondary">Low</Badge>;
		default:
			return <Badge variant="outline">{priority}</Badge>;
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
		case "in_progress":
			return <Badge variant="secondary">In progress</Badge>;
		case "blocked":
			return <Badge variant="destructive">Blocked</Badge>;
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
		case "ready":
			return <Badge variant="secondary">Ready</Badge>;
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

export default function TaskDetailPage() {
	const params = useParams<{
		organizationSlug: string;
		taskId: string;
	}>();
	const { bookingReadOrList, deliverableReadOrList } =
		useStudioCapabilities();
	const { openEdit } = useTaskParams();

	const { data: taskData, isLoading: taskLoading } = useQuery(
		tasksApi.getOptions(params.taskId),
	);

	const task = taskData?.data;

	const {
		data: submissionsData,
		isLoading: submissionsLoading,
		isError: submissionsError,
	} = useQuery({
		...submissionsApi.listOptions({
			taskId: params.taskId,
			sortBy: "submittedAt",
			sortDirection: "asc",
		}),
		enabled: !!params.taskId,
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
		if (!task?.assignments) {
			return submissions;
		}
		const assignedCrewIds = new Set(task.assignments.map((a) => a.crewId));
		return submissions.filter((s) => !assignedCrewIds.has(s.submittedBy));
	}, [submissions, task?.assignments]);

	const tasksHref = `/app/${params.organizationSlug}/tasks`;

	if (taskLoading) {
		return (
			<div className="mx-auto w-full max-w-[800px] py-6 px-4">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="mt-8 h-8 w-96" />
				<Skeleton className="mt-4 h-4 w-64" />
				<Skeleton className="mt-6 h-24 w-full" />
			</div>
		);
	}

	if (!task) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-muted-foreground">Task not found</div>
			</div>
		);
	}

	const booking = task.booking;
	const {
		deliverableId: convertedFromDeliverableId,
		deliverableName: convertedFromDeliverableName,
	} = getConvertedFromDeliverable(task.metadata);

	return (
		<div className="mx-auto w-full max-w-[800px] py-6 px-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm">
					<Link
						href={tasksHref}
						className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
					>
						<ClipboardListIcon className="size-4" />
						Tasks
					</Link>
					<ChevronRight className="size-4 text-muted-foreground" />
					<span className="font-medium text-foreground truncate max-w-[300px]">
						{task.name}
					</span>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => openEdit(task.id)}
				>
					<PencilIcon className="mr-1 size-4" />
					Edit
				</Button>
			</div>

			<div className="mt-8">
				<h1 className="text-2xl font-semibold">{task.name}</h1>
				<div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
					<span>in</span>
					{bookingReadOrList ? (
						<Link
							href={`/app/${params.organizationSlug}/bookings/${booking.id}`}
							className="font-medium text-foreground hover:underline"
						>
							{booking.name}
						</Link>
					) : (
						<span className="font-medium text-foreground">
							{booking.name}
						</span>
					)}
					{convertedFromDeliverableId && (
						<>
							<span>·</span>
							<span>Converted from</span>
							{deliverableReadOrList ? (
								<Link
									href={`/app/${params.organizationSlug}/deliverables/${convertedFromDeliverableId}`}
									target="_blank"
									rel="noopener noreferrer"
									className="font-medium text-foreground hover:underline"
								>
									{convertedFromDeliverableName ??
										"Deliverable"}
								</Link>
							) : (
								<span className="font-medium text-foreground">
									{convertedFromDeliverableName ??
										"Deliverable"}
								</span>
							)}
						</>
					)}
					{task.dueDate && (
						<>
							<span>·</span>
							<span className="flex items-center gap-1">
								<CalendarIcon className="size-3" />
								Due{" "}
								{format(new Date(task.dueDate), "MMM d, yyyy")}
							</span>
						</>
					)}
					<span>·</span>
					<span>
						Created{" "}
						{format(new Date(task.createdAt), "MMM d, yyyy")}
					</span>
				</div>

				<div className="mt-4 flex flex-wrap items-center gap-2">
					{getStatusBadge(task.status)}
					{getPriorityBadge(task.priority)}
					{getWorkflowStatusBadge(task.workflowStatus)}
				</div>

				{task.description && (
					<p className="mt-6 text-foreground whitespace-pre-wrap">
						{task.description}
					</p>
				)}

				{task.assignments && task.assignments.length > 0 && (
					<div className="mt-4 flex flex-wrap gap-2">
						{task.assignments.map((assignment) => (
							<Badge
								key={assignment.id}
								variant="secondary"
								className="flex items-center gap-1.5"
								title={
									assignment.assignedByName
										? `Assigned by ${assignment.assignedByName}`
										: undefined
								}
							>
								<UserAvatar
									name={assignment.crew.name}
									className="size-4"
								/>
								<span>{assignment.crew.name}</span>
								<span className="text-muted-foreground">
									·{" "}
									{assignment.progressStatus.replaceAll(
										"_",
										" ",
									)}
								</span>
								{assignment.assignedByName ? (
									<span className="text-muted-foreground">
										· assigned by{" "}
										{assignment.assignedByName}
									</span>
								) : null}
							</Badge>
						))}
					</div>
				)}
			</div>

			{task.deliverableLinks.length > 0 ? (
				<section className="mt-8 flex flex-col gap-3 border-t pt-6">
					<div>
						<h2 className="font-semibold">Linked deliverables</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Task progress automatically updates required
							deliverables.
						</p>
					</div>
					<div className="divide-y rounded-lg border">
						{task.deliverableLinks.map((deliverableLink) => (
							<div
								key={deliverableLink.id}
								className="flex items-center justify-between gap-3 px-4 py-3"
							>
								<div className="flex min-w-0 items-center gap-3">
									<PackageIcon className="size-4 shrink-0 text-muted-foreground" />
									<Link
										href={`/app/${params.organizationSlug}/deliverables/${deliverableLink.deliverable.id}`}
										className="truncate text-sm font-medium hover:underline"
									>
										{deliverableLink.deliverable.name}
									</Link>
								</div>
								<div className="flex gap-2">
									<Badge variant="secondary">
										{deliverableLink.kind}
									</Badge>
									<Badge variant="outline">
										{deliverableLink.deliverable.workflowStatus.replaceAll(
											"_",
											" ",
										)}
									</Badge>
								</div>
							</div>
						))}
					</div>
				</section>
			) : null}

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
						{(task.assignments?.length > 0 ||
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
							{task.assignments && task.assignments.length > 0 ? (
								task.assignments.map((assignment) => {
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
												<Badge variant="outline">
													{assignment.progressStatus.replaceAll(
														"_",
														" ",
													)}
												</Badge>
												{assignment.assignedByName ? (
													<span>
														by{" "}
														<span className="font-medium text-foreground">
															{
																assignment.assignedByName
															}
														</span>
													</span>
												) : null}
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
									No crew assigned to this task yet.
								</div>
							)}

							{task.assignments &&
								task.assignments.length > 0 &&
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
