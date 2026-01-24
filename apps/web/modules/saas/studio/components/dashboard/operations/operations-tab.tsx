"use client";

import type { OperationsData } from "@repo/api/modules/studio/schemas/dashboard";
import { Skeleton } from "@repo/ui/components/skeleton";
import { PendingDeliverablesPanel } from "./pending-deliverables-panel";
import { PendingTasksPanel } from "./pending-tasks-panel";
import { OperationsStatCards } from "./stat-cards";
import { UpcomingShootsPanel } from "./upcoming-shoots-panel";

interface OperationsTabProps {
	organizationSlug: string;
	data?: OperationsData;
	isLoading?: boolean;
}

export function OperationsTab({
	organizationSlug,
	data,
	isLoading,
}: OperationsTabProps) {
	if (isLoading || !data) {
		return <OperationsTabSkeleton />;
	}

	return (
		<div className="flex flex-col gap-6">
			<OperationsStatCards
				shootsThisWeek={data.shootsThisWeek}
				overdueTasksCount={data.overdueTasksCount}
				overdueDeliverablesCount={data.overdueDeliverablesCount}
			/>

			<div className="grid gap-6 lg:grid-cols-3">
				<UpcomingShootsPanel
					shoots={data.upcomingShoots}
					organizationSlug={organizationSlug}
				/>
				<PendingTasksPanel
					tasks={data.pendingTasks}
					organizationSlug={organizationSlug}
				/>
				<PendingDeliverablesPanel
					deliverables={data.pendingDeliverables}
					organizationSlug={organizationSlug}
				/>
			</div>
		</div>
	);
}

function OperationsTabSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<div className="grid gap-4 md:grid-cols-3">
				{Array.from({ length: 3 }).map((_, i) => (
					<Skeleton key={i} className="h-20 rounded-lg" />
				))}
			</div>
			<div className="grid gap-6 lg:grid-cols-3">
				{Array.from({ length: 3 }).map((_, i) => (
					<Skeleton key={i} className="h-80 rounded-lg" />
				))}
			</div>
		</div>
	);
}
