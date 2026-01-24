"use client";

import { Button } from "@repo/ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { dashboardApi } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { DashboardSkeleton } from "./dashboard-skeleton";
import {
	type DateRange,
	DateRangeFilter,
	getDefaultDateRange,
} from "./date-range-filter";
import { OperationsTab } from "./operations";
import { OverviewTab } from "./overview";

type DashboardTab = "overview" | "operations" | "financial";

const DASHBOARD_TABS = [
	{ value: "overview", label: "Overview" },
	{ value: "operations", label: "Operations" },
	{ value: "financial", label: "Financial" },
] as const;

interface DashboardViewProps {
	organizationSlug: string;
}

export function DashboardView({ organizationSlug }: DashboardViewProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const queryClient = useQueryClient();
	const [isPending, startTransition] = useTransition();
	const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);

	const queryInput = useMemo(
		() => ({
			dateRange: {
				start: dateRange.from,
				end: dateRange.to,
			},
		}),
		[dateRange],
	);

	const activeTab = useMemo(() => {
		const tabParam = searchParams.get("tab");
		const isValidTab = DASHBOARD_TABS.some((tab) => tab.value === tabParam);
		return isValidTab ? (tabParam as DashboardTab) : "overview";
	}, [searchParams]);

	const dashboardQuery = useQuery({
		...dashboardApi.getOptions(queryInput),
		staleTime: 60_000,
		refetchOnWindowFocus: true,
	});

	const actionsQuery = useQuery({
		...dashboardApi.actionsOptions(),
		staleTime: 30_000,
		refetchOnWindowFocus: true,
	});

	const operationsQuery = useQuery({
		...dashboardApi.operationsOptions({
			dateRange: {
				start: dateRange.from,
				end: dateRange.to,
			},
			limit: 10,
		}),
		staleTime: 60_000,
		refetchOnWindowFocus: true,
		enabled: activeTab === "operations",
	});

	const handleRefresh = () => {
		queryClient.invalidateQueries({ queryKey: orpc.dashboard.key() });
	};

	const handleTabChange = (value: string) => {
		const nextTab = value as DashboardTab;
		const params = new URLSearchParams(searchParams.toString());
		if (nextTab === "overview") {
			params.delete("tab");
		} else {
			params.set("tab", nextTab);
		}
		const queryString = params.toString();
		const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
		startTransition(() => {
			router.push(nextUrl, { scroll: false });
		});
	};

	const isLoading = dashboardQuery.isLoading || actionsQuery.isLoading;
	const isRefreshing =
		dashboardQuery.isFetching ||
		actionsQuery.isFetching ||
		operationsQuery.isFetching;

	if (isLoading) {
		return <DashboardSkeleton />;
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Tabs value={activeTab} onValueChange={handleTabChange}>
					<TabsList>
						{DASHBOARD_TABS.map((tab) => (
							<TabsTrigger key={tab.value} value={tab.value}>
								{tab.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<div className="flex items-center gap-2">
					<DateRangeFilter
						value={dateRange}
						onChange={setDateRange}
					/>
					<Button
						variant="outline"
						size="sm"
						onClick={handleRefresh}
						disabled={isRefreshing}
					>
						<RefreshCwIcon
							className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
						/>
						<span className="sr-only">Refresh</span>
					</Button>
				</div>
			</div>

			{activeTab === "overview" && (
				<OverviewTab
					organizationSlug={organizationSlug}
					data={dashboardQuery.data?.data}
					actions={actionsQuery.data?.data}
					isLoading={isPending}
				/>
			)}

			{activeTab === "operations" && (
				<OperationsTab
					organizationSlug={organizationSlug}
					data={operationsQuery.data?.data}
					isLoading={operationsQuery.isLoading}
				/>
			)}

			{activeTab === "financial" && (
				<div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
					Financial tab coming in Phase 3
				</div>
			)}
		</div>
	);
}
