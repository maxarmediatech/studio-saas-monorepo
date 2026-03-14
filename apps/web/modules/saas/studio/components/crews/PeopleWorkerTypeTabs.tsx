"use client";

import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { useCrewsTable } from "@saas/studio/hooks/tables";

const PEOPLE_TABS = [
	{ value: "all", label: "All" },
	{ value: "internal", label: "Internal" },
	{ value: "freelancer", label: "Freelancers" },
] as const;

export function PeopleWorkerTypeTabs() {
	const { filters, setFilter } = useCrewsTable();
	const activeTab = filters.workerType?.[0] ?? "all";

	return (
		<Tabs
			value={activeTab}
			onValueChange={(value) =>
				setFilter("workerType", value === "all" ? null : [value])
			}
		>
			<TabsList>
				{PEOPLE_TABS.map((tab) => (
					<TabsTrigger key={tab.value} value={tab.value}>
						{tab.label}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
