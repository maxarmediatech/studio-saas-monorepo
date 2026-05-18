"use client";

import type {
	DashboardData,
	QuickActionsData,
} from "@repo/api/modules/studio/schemas/dashboard";
import { KpiCards } from "./kpi-cards";
import { NeedsAttention } from "./needs-attention";
import { OperationsSummary } from "./operations-summary";
import { RecentBookings } from "./recent-bookings";
import { UpcomingShoots } from "./upcoming-shoots";
import { WhatsAppSummary } from "./whatsapp-summary";

interface OverviewTabProps {
	organizationSlug: string;
	data?: DashboardData;
	actions?: QuickActionsData;
	isLoading?: boolean;
}

export function OverviewTab({
	organizationSlug,
	data,
	actions,
	isLoading,
}: OverviewTabProps) {
	if (!data) {
		return null;
	}

	return (
		<div className="flex flex-col gap-6">
			<KpiCards financial={data.financial} isLoading={isLoading} />

			<OperationsSummary
				operations={data.operations}
				organizationSlug={organizationSlug}
				isLoading={isLoading}
			/>

			{actions && actions.actions.length > 0 && (
				<NeedsAttention
					actions={actions.actions}
					totalCount={actions.totalCount}
					organizationSlug={organizationSlug}
				/>
			)}

			<WhatsAppSummary
				data={data.whatsapp}
				organizationSlug={organizationSlug}
			/>

			<div className="grid gap-6 lg:grid-cols-2">
				<RecentBookings
					bookings={data.recentBookings}
					organizationSlug={organizationSlug}
				/>
				<UpcomingShoots
					shoots={data.upcomingShoots}
					organizationSlug={organizationSlug}
				/>
			</div>
		</div>
	);
}
