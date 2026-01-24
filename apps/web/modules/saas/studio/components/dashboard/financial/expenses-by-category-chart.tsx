"use client";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { useMemo } from "react";

interface ExpensesByCategoryChartProps {
	byCategory: Record<string, string>;
}

const COLORS = [
	"hsl(var(--chart-1))",
	"hsl(var(--chart-2))",
	"hsl(var(--chart-3))",
	"hsl(var(--chart-4))",
	"hsl(var(--chart-5))",
];

const currencyFormatter = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	maximumFractionDigits: 0,
});

export function ExpensesByCategoryChart({
	byCategory,
}: ExpensesByCategoryChartProps) {
	const { data, maxValue, isEmpty } = useMemo(() => {
		const entries = Object.entries(byCategory);
		if (entries.length === 0) {
			return { data: [], maxValue: 0, isEmpty: true };
		}

		const chartData = entries
			.map(([category, value]) => ({
				category: category || "Uncategorized",
				amount: Number.parseFloat(value) || 0,
			}))
			.sort((a, b) => b.amount - a.amount)
			.slice(0, 8);

		const max = chartData.reduce(
			(currentMax, item) => Math.max(currentMax, item.amount),
			0,
		);

		return {
			data: chartData.map((item, index) => ({
				...item,
				color: COLORS[index % COLORS.length],
			})),
			maxValue: max,
			isEmpty: max === 0,
		};
	}, [byCategory]);

	const formatCurrency = (value: number) => currencyFormatter.format(value);

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-base font-medium">
					Expenses by Category
				</CardTitle>
			</CardHeader>
			<CardContent>
				{isEmpty ? (
					<div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
						No expense data for this period
					</div>
				) : (
					<div className="space-y-3">
						{data.map((item) => {
							const width =
								maxValue > 0 && item.amount > 0
									? Math.max(
											6,
											(item.amount / maxValue) * 100,
										)
									: 0;

							return (
								<div
									key={item.category}
									className="flex items-center gap-3"
								>
									<span className="w-24 truncate text-xs text-muted-foreground">
										{item.category}
									</span>
									<div className="h-2 flex-1 rounded-full bg-muted">
										<div
											className="h-2 rounded-full"
											style={{
												width: `${width}%`,
												backgroundColor: item.color,
											}}
										/>
									</div>
									<span className="text-xs font-medium tabular-nums">
										{formatCurrency(item.amount)}
									</span>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
