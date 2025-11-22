"use client";

import { useDashboardStore } from "@/modules/dashboard/store/dashboard-store";

import { ChartCard } from "./chart-card";
import { PeopleTable } from "./people-table";
import { RecentDocuments } from "./recent-documents";
import { StatCard } from "./stat-card";

export function DashboardContent() {
	const { stats } = useDashboardStore();

	return (
		<div className="w-full overflow-y-auto overflow-x-hidden p-4 h-full">
			<div className="mx-auto w-full space-y-6">
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{stats.map((stat) => (
						<StatCard
							key={stat.id}
							title={stat.title}
							value={stat.value}
							icon={stat.icon}
						/>
					))}
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<ChartCard />
					<RecentDocuments />
				</div>

				<PeopleTable />
			</div>
		</div>
	);
}
