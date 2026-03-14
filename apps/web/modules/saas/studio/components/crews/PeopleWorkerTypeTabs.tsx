"use client";

import { cn } from "@repo/ui/lib/utils";
import { useCrewsTable } from "@saas/studio/hooks/tables";
import { PEOPLE_WORKER_TYPE_TABS } from "@saas/studio/lib/people";

export function PeopleWorkerTypeTabs() {
	const { filters, setFilter } = useCrewsTable();
	const activeTab = filters.workerType?.[0] ?? "all";

	return (
		<div className="border-b border-neutral-200">
			<div className="-mb-px flex gap-6 overflow-x-auto">
				{PEOPLE_WORKER_TYPE_TABS.map((tab) => {
					const isActive = activeTab === tab.value;

					return (
						<button
							key={tab.value}
							type="button"
							onClick={() =>
								setFilter(
									"workerType",
									tab.value === "all" ? null : [tab.value],
								)
							}
							className={cn(
								"relative shrink-0 py-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
								isActive && "text-foreground",
							)}
							aria-pressed={isActive}
						>
							{tab.label}
							{isActive && (
								<div className="absolute inset-x-0 bottom-0 h-0.5 bg-neutral-900" />
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
