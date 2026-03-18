"use client";

import type { YourWorkEntityType } from "@repo/api/modules/studio/schemas/your-work";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";
import { useStudioCapabilities } from "@saas/studio/components/studio-capabilities-context";
import { yourWorkApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, LayoutList } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { YourWorkGroupedList } from "./your-work-grouped-list";
import { YourWorkTable } from "./your-work-table";

type EntityTypeFilter = "all" | YourWorkEntityType;
type ViewMode = "grouped" | "table";

const ENTITY_TABS = [
	{ value: "all", label: "All" },
	{ value: "shoot", label: "Shoots" },
	{ value: "task", label: "Tasks" },
	{ value: "deliverable", label: "Deliverables" },
] as const;

const queryDefaults = {
	staleTime: 60_000,
	gcTime: 5 * 60_000,
	refetchOnWindowFocus: false,
};

interface YourWorkViewProps {
	organizationSlug: string;
	initialFilters: {
		entityType: EntityTypeFilter;
		view: ViewMode;
	};
}

export function YourWorkView({
	organizationSlug,
	initialFilters,
}: YourWorkViewProps) {
	const { shootReadOrList, taskReadOrList, deliverableReadOrList } =
		useStudioCapabilities();
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [filters, setFilters] = useState(initialFilters);
	const visibleEntityTabs = useMemo(
		() =>
			ENTITY_TABS.filter((tab) => {
				if (tab.value === "all") {
					return true;
				}
				if (tab.value === "shoot") {
					return shootReadOrList;
				}
				if (tab.value === "task") {
					return taskReadOrList;
				}
				if (tab.value === "deliverable") {
					return deliverableReadOrList;
				}
				return false;
			}),
		[deliverableReadOrList, shootReadOrList, taskReadOrList],
	);

	const queryInput = useMemo(
		() => ({
			entityType: filters.entityType,
			page: 1,
			limit: 50,
		}),
		[filters.entityType],
	);

	const assignedQuery = useQuery({
		...yourWorkApi.listOptions({ ...queryInput, view: "assigned" }),
		...queryDefaults,
	});
	const createdQuery = useQuery({
		...yourWorkApi.listOptions({ ...queryInput, view: "created" }),
		...queryDefaults,
	});
	const subscribedQuery = useQuery({
		...yourWorkApi.listOptions({ ...queryInput, view: "subscribed" }),
		...queryDefaults,
	});

	const updateEntityType = (nextEntityType: EntityTypeFilter) => {
		setFilters((current) => ({ ...current, entityType: nextEntityType }));
		const params = new URLSearchParams();
		if (nextEntityType !== "all") {
			params.set("entityType", nextEntityType);
		}
		if (filters.view !== "grouped") {
			params.set("view", filters.view);
		}
		const queryString = params.toString();
		const url = `/app/${organizationSlug}/your-work${queryString ? `?${queryString}` : ""}`;

		startTransition(() => {
			router.push(url, { scroll: false });
		});
	};

	const updateView = (nextView: ViewMode) => {
		setFilters((current) => ({ ...current, view: nextView }));
		const params = new URLSearchParams();
		if (filters.entityType !== "all") {
			params.set("entityType", filters.entityType);
		}
		if (nextView !== "grouped") {
			params.set("view", nextView);
		}
		const queryString = params.toString();
		const url = `/app/${organizationSlug}/your-work${queryString ? `?${queryString}` : ""}`;

		startTransition(() => {
			router.push(url, { scroll: false });
		});
	};

	const groupedItems = useMemo(
		() => ({
			assigned: assignedQuery.data?.data ?? [],
			created: createdQuery.data?.data ?? [],
			subscribed: subscribedQuery.data?.data ?? [],
		}),
		[
			assignedQuery.data?.data,
			createdQuery.data?.data,
			subscribedQuery.data?.data,
		],
	);

	const tableItems = useMemo(() => {
		const entries = [
			{ items: groupedItems.assigned, label: "Assigned" },
			{ items: groupedItems.created, label: "Created" },
			{ items: groupedItems.subscribed, label: "Watching" },
		];

		return entries.flatMap(({ items, label }) =>
			items.map((item) => ({
				...item,
				groupLabel: label,
				rowKey: `${item.id}:${label}`,
			})),
		);
	}, [groupedItems]);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Tabs
					value={filters.entityType}
					onValueChange={(value) =>
						updateEntityType(value as EntityTypeFilter)
					}
				>
					<TabsList>
						{visibleEntityTabs.map((tab) => (
							<TabsTrigger key={tab.value} value={tab.value}>
								{tab.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<ToggleGroup
					type="single"
					value={filters.view}
					onValueChange={(value) => {
						if (value) {
							updateView(value as ViewMode);
						}
					}}
					variant="outline"
					size="sm"
					className="gap-1"
				>
					<ToggleGroupItem
						value="grouped"
						aria-label="Grouped view"
						className="size-8 p-0"
					>
						<LayoutGrid className="size-4" />
					</ToggleGroupItem>
					<ToggleGroupItem
						value="table"
						aria-label="Table view"
						className="size-8 p-0"
					>
						<LayoutList className="size-4" />
					</ToggleGroupItem>
				</ToggleGroup>
			</div>

			{filters.view === "grouped" ? (
				<YourWorkGroupedList
					organizationSlug={organizationSlug}
					entityType={filters.entityType}
					groups={[
						{
							id: "assigned",
							title: "Assigned",
							items: groupedItems.assigned,
							isLoading: assignedQuery.isLoading || isPending,
						},
						{
							id: "created",
							title: "Created",
							items: groupedItems.created,
							isLoading: createdQuery.isLoading || isPending,
						},
						{
							id: "subscribed",
							title: "Watching",
							items: groupedItems.subscribed,
							isLoading: subscribedQuery.isLoading || isPending,
						},
					]}
				/>
			) : (
				<YourWorkTable
					organizationSlug={organizationSlug}
					data={tableItems}
					isLoading={
						assignedQuery.isLoading ||
						createdQuery.isLoading ||
						subscribedQuery.isLoading ||
						isPending
					}
					isFetching={
						assignedQuery.isFetching ||
						createdQuery.isFetching ||
						subscribedQuery.isFetching
					}
					showGroup
				/>
			)}
		</div>
	);
}
