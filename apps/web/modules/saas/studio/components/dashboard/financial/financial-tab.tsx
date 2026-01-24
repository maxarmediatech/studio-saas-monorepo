"use client";

import type { DashboardData } from "@repo/api/modules/studio/schemas/dashboard";
import { Skeleton } from "@repo/ui/components/skeleton";
import { expensesApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { DateRange } from "../date-range-filter";
import { ExpensesByCategoryChart } from "./expenses-by-category-chart";
import { ExpensesSplitChart } from "./expenses-split-chart";
import { FinancialStatCards } from "./financial-stat-cards";
import { RecentExpenses } from "./recent-expenses";

interface FinancialTabProps {
	organizationSlug: string;
	dateRange: DateRange;
	dashboardData?: DashboardData;
}

export function FinancialTab({
	organizationSlug,
	dateRange,
	dashboardData,
}: FinancialTabProps) {
	const expenseStatsQuery = useQuery({
		...expensesApi.statsOptions({
			dateFrom: dateRange.from,
			dateTo: dateRange.to,
		}),
		staleTime: 60_000,
	});

	const recentExpensesQuery = useQuery({
		...expensesApi.listOptions({
			dateFrom: dateRange.from,
			dateTo: dateRange.to,
			limit: 5,
			sortBy: "expenseDate",
			sortDirection: "desc",
		}),
		staleTime: 60_000,
	});

	const isLoading =
		expenseStatsQuery.isLoading || recentExpensesQuery.isLoading;

	if (isLoading) {
		return <FinancialTabSkeleton />;
	}

	const expenseStats = expenseStatsQuery.data?.data;
	const recentExpenses = recentExpensesQuery.data?.data ?? [];

	const collected =
		Number.parseFloat(dashboardData?.financial?.totalReceived ?? "0") || 0;
	const totalExpenses =
		Number.parseFloat(expenseStats?.totalExpenses ?? "0") || 0;
	const netProfit = collected - totalExpenses;

	return (
		<div className="flex flex-col gap-6">
			<FinancialStatCards
				revenue={dashboardData?.financial?.totalRevenue ?? "0"}
				collected={dashboardData?.financial?.totalReceived ?? "0"}
				totalExpenses={expenseStats?.totalExpenses ?? "0"}
				netProfit={netProfit}
			/>

			<div className="grid gap-6 lg:grid-cols-2">
				<ExpensesByCategoryChart
					byCategory={expenseStats?.byCategory ?? {}}
				/>
				<ExpensesSplitChart byBillTo={expenseStats?.byBillTo ?? {}} />
			</div>

			<RecentExpenses
				expenses={recentExpenses}
				organizationSlug={organizationSlug}
			/>
		</div>
	);
}

function FinancialTabSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-20 rounded-lg" />
				))}
			</div>
			<div className="grid gap-6 lg:grid-cols-2">
				<Skeleton className="h-[280px] rounded-lg" />
				<Skeleton className="h-[280px] rounded-lg" />
			</div>
			<Skeleton className="h-[300px] rounded-lg" />
		</div>
	);
}
