"use client";

import type { YourWorkEntityType } from "@repo/api/modules/studio/schemas/your-work";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { yourWorkApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { YourWorkGroupedList } from "./your-work-grouped-list";

type EntityTypeFilter = "all" | YourWorkEntityType;

const ENTITY_TABS = [
	{ value: "all", label: "All" },
	{ value: "shoot", label: "Shoots" },
	{ value: "task", label: "Tasks" },
	{ value: "deliverable", label: "Deliverables" },
] as const;

interface YourWorkViewProps {
	organizationSlug: string;
	initialFilters: {
		entityType: EntityTypeFilter;
	};
}

export function YourWorkView({
	organizationSlug,
	initialFilters,
}: YourWorkViewProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [filters, setFilters] = useState(initialFilters);

	const queryInput = useMemo(
		() => ({
			entityType: filters.entityType,
			page: 1,
			limit: 50,
		}),
		[filters.entityType],
	);

	const assignedQuery = useQuery(
		yourWorkApi.listOptions({ ...queryInput, view: "assigned" }),
	);
	const createdQuery = useQuery(
		yourWorkApi.listOptions({ ...queryInput, view: "created" }),
	);
	const subscribedQuery = useQuery(
		yourWorkApi.listOptions({ ...queryInput, view: "subscribed" }),
	);

	const updateEntityType = (nextEntityType: EntityTypeFilter) => {
		setFilters({ entityType: nextEntityType });
		const params = new URLSearchParams();
		if (nextEntityType !== "all") {
			params.set("entityType", nextEntityType);
		}
		const queryString = params.toString();
		const url = `/app/${organizationSlug}/your-work${queryString ? `?${queryString}` : ""}`;

		startTransition(() => {
			router.push(url, { scroll: false });
		});
	};

	return (
		<div className="flex flex-col gap-6">
			<Tabs
				value={filters.entityType}
				onValueChange={(value) => updateEntityType(value as EntityTypeFilter)}
			>
				<TabsList>
					{ENTITY_TABS.map((tab) => (
						<TabsTrigger key={tab.value} value={tab.value}>
							{tab.label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>

			<YourWorkGroupedList
				organizationSlug={organizationSlug}
				entityType={filters.entityType}
				groups={[
					{
						id: "assigned",
						title: "Assigned",
						items: assignedQuery.data?.data ?? [],
						isLoading: assignedQuery.isLoading || isPending,
					},
					{
						id: "created",
						title: "Created",
						items: createdQuery.data?.data ?? [],
						isLoading: createdQuery.isLoading || isPending,
					},
					{
						id: "subscribed",
						title: "Watching",
						items: subscribedQuery.data?.data ?? [],
						isLoading: subscribedQuery.isLoading || isPending,
					},
				]}
			/>
		</div>
	);
}
