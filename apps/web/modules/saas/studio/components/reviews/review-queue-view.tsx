"use client";

import type { SubmissionListItem } from "@repo/api/modules/studio/schemas/submission";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Label } from "@repo/ui/components/label";
import { Switch } from "@repo/ui/components/switch";
import { useSession } from "@saas/auth/hooks/use-session";
import { PageContent } from "@saas/studio";
import { useReviewQueueParams } from "@saas/studio/hooks/params/use-review-queue-params";
import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Inbox, ListChecks, Package } from "lucide-react";
import { useMemo } from "react";
import { SubmissionCard } from "./submission-card";

const ASSIGNMENT_TYPE_OPTIONS: {
	id: "all" | "task" | "deliverable";
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}[] = [
	{ id: "all", label: "All", icon: Inbox },
	{ id: "task", label: "Tasks", icon: ListChecks },
	{ id: "deliverable", label: "Deliverables", icon: Package },
];

const STATUS_FILTER_OPTIONS: {
	id:
		| "all"
		| "ready_for_review"
		| "changes_requested"
		| "approved"
		| "rejected";
	label: string;
}[] = [
	{ id: "all", label: "All" },
	{ id: "ready_for_review", label: "Ready for Review" },
	{ id: "changes_requested", label: "Changes Requested" },
	{ id: "approved", label: "Approved" },
	{ id: "rejected", label: "Rejected" },
];

const PAGE_SIZE = 10;

export function ReviewQueueView() {
	const { user } = useSession();
	const {
		assignmentType,
		setAssignmentType,
		status,
		setStatus,
		assignedToMe,
		setAssignedToMe,
	} = useReviewQueueParams();

	const statusFilter = useMemo(() => {
		switch (status) {
			case "all":
				return { status: undefined, pendingReviewOnly: false };
			case "ready_for_review":
				return { status: undefined, pendingReviewOnly: true };
			case "changes_requested":
				return { status: "revision_requested", pendingReviewOnly: false };
			case "approved":
				return { status: "approved", pendingReviewOnly: false };
			case "rejected":
				return { status: "rejected", pendingReviewOnly: false };
			default:
				return { status: undefined, pendingReviewOnly: true };
		}
	}, [status]);

	const submissionsKey = orpc.submissions.key();

	const submissionsQuery = useInfiniteQuery({
		queryKey: [
			...submissionsKey,
			"review-queue",
			assignmentType,
			status,
			assignedToMe,
			user?.id,
		],
		queryFn: async ({ pageParam }) =>
			orpcClient.submissions.list({
				page: pageParam,
				limit: PAGE_SIZE,
				sortBy: "submittedAt",
				sortDirection: "desc",
				entityType:
					assignmentType === "all" ? undefined : assignmentType,
				pendingReviewOnly: statusFilter.pendingReviewOnly,
				status: statusFilter.status as
					| "draft"
					| "submitted"
					| "in_review"
					| "approved"
					| "rejected"
					| "revision_requested"
					| undefined,
				reviewedBy: assignedToMe ? user?.id : undefined,
			}),
		getNextPageParam: (lastPage) =>
			lastPage.pagination.page < lastPage.pagination.pageCount
				? lastPage.pagination.page + 1
				: undefined,
		initialPageParam: 1,
		enabled: !assignedToMe || Boolean(user?.id),
	});

	const submissions =
		submissionsQuery.data?.pages.flatMap(
			(page) => page.data as SubmissionListItem[],
		) ?? [];

	const totalSubmissions =
		submissionsQuery.data?.pages[0]?.pagination.total ?? 0;

	const statusLabel =
		STATUS_FILTER_OPTIONS.find((option) => option.id === status)?.label ??
		"All";

	const headerDescription = submissionsQuery.isLoading
		? "Loading submissions..."
		: status === "all"
			? `Showing ${totalSubmissions} submissions`
			: `Showing ${totalSubmissions} ${statusLabel.toLowerCase()}`;

	return (
		<PageContent
			title="Review Queue"
		>
			<div className="grid grid-cols-1 gap-10 lg:grid-cols-[260px_1fr]">
				<aside className="flex flex-col gap-4">
					<Card className="py-0">
						<CardContent className="p-0">
							<div className="border-b border-border px-4 py-3">
								<h2 className="text-sm font-semibold">
									Filter Submissions
								</h2>
								<p className="mt-1 text-xs text-muted-foreground">
									Track and manage all review requests.
								</p>
							</div>
							<nav className="space-y-1 p-2">
								{ASSIGNMENT_TYPE_OPTIONS.map((option) => (
									<button
										type="button"
										key={option.id}
										onClick={() =>
											setAssignmentType(option.id)
										}
										className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
											assignmentType === option.id
												? "bg-primary/10 text-primary"
												: "text-muted-foreground hover:bg-muted"
										}`}
									>
										<option.icon className="h-4 w-4" />
										{option.label}
									</button>
								))}
							</nav>
						</CardContent>
					</Card>
				</aside>

				<main className="space-y-6">
					<div className="flex items-center justify-between gap-4">
						<span className="text-sm text-muted-foreground">
							{headerDescription}
						</span>
						<div className="flex items-center justify-end gap-2">
							<Switch
								id="assigned-to-me"
								checked={assignedToMe ?? false}
								onCheckedChange={setAssignedToMe}
							/>
							<Label htmlFor="assigned-to-me">
								Assigned to me
							</Label>
						</div>
					</div>

					<div className="flex flex-wrap gap-2 border-b pb-4">
						{STATUS_FILTER_OPTIONS.map((option) => (
							<Button
								key={option.id}
								variant={
									status === option.id
										? "secondary"
										: "ghost"
								}
								size="sm"
								onClick={() => setStatus(option.id)}
								className="rounded-full"
							>
								{option.label}
							</Button>
						))}
					</div>

					{submissionsQuery.isLoading && (
						<div className="text-sm text-muted-foreground">
							Loading submissions...
						</div>
					)}

					{submissionsQuery.isError && (
						<div className="text-sm text-destructive">
							Unable to load submissions right now.
						</div>
					)}

					{!submissionsQuery.isLoading &&
						submissions.length === 0 && <EmptyState />}

					{submissions.length > 0 && (
						<div className="space-y-4">
							{submissions.map((submission) => (
								<SubmissionCard
									key={submission.id}
									submission={submission}
								/>
							))}
						</div>
					)}

					{submissionsQuery.hasNextPage && (
						<div className="flex justify-center">
							<Button
								variant="outline"
								onClick={() =>
									submissionsQuery.fetchNextPage()
								}
								disabled={
									submissionsQuery.isFetchingNextPage
								}
							>
								{submissionsQuery.isFetchingNextPage
									? "Loading..."
									: "Load More"}
							</Button>
						</div>
					)}
				</main>
			</div>
		</PageContent>
	);
}

function EmptyState() {
	return (
		<Card className="flex items-center justify-center p-12 text-center">
			<CardContent className="space-y-2">
				<div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
					<Inbox className="h-5 w-5 text-muted-foreground" />
				</div>
				<h3 className="text-lg font-medium">No submissions found</h3>
				<p className="text-sm text-muted-foreground">
					Try adjusting your filters to find what you need.
				</p>
			</CardContent>
		</Card>
	);
}
