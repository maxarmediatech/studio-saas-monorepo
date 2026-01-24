"use client";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { useMemo } from "react";

interface ExpensesSplitChartProps {
	byBillTo: Record<string, string>;
}

const BILL_TO_LABELS: Record<string, string> = {
	studio: "Studio",
	client: "Client",
};

const BILL_TO_COLORS: Record<string, string> = {
	studio: "hsl(var(--chart-1))",
	client: "hsl(var(--chart-2))",
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	maximumFractionDigits: 0,
});

export function ExpensesSplitChart({ byBillTo }: ExpensesSplitChartProps) {
	const { data, total, isEmpty } = useMemo(() => {
		const entries = Object.entries(byBillTo);
		if (entries.length === 0) {
			return {
				data: [],
				total: 0,
				isEmpty: true,
			};
		}

		let sum = 0;
		const chartData = entries.map(([billTo, value]) => {
			const amount = Number.parseFloat(value) || 0;
			sum += amount;
			return {
				name: BILL_TO_LABELS[billTo] || billTo,
				value: amount,
				fill: BILL_TO_COLORS[billTo] || "hsl(var(--chart-3))",
			};
		});

		return {
			data: chartData,
			total: sum,
			isEmpty: sum === 0,
		};
	}, [byBillTo]);

	const formatCurrency = (value: number) => currencyFormatter.format(value);

	const formatPercent = (value: number) =>
		total > 0 ? `${((value / total) * 100).toFixed(0)}%` : "0%";

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-base font-medium">
					Expense Split (Studio vs Client)
				</CardTitle>
			</CardHeader>
			<CardContent>
				{isEmpty ? (
					<div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
						No expense data for this period
					</div>
				) : (
					<div className="space-y-3">
						{data.map((item) => (
							<div
								key={item.name}
								className="flex items-center gap-3"
							>
								<span className="w-20 text-xs text-muted-foreground">
									{item.name}
								</span>
								<div className="h-2 flex-1 rounded-full bg-muted">
									<div
										className="h-2 rounded-full"
										style={{
											width: `${formatPercent(item.value)}`,
											backgroundColor: item.fill,
										}}
									/>
								</div>
								<span className="text-xs font-medium tabular-nums">
									{formatCurrency(item.value)}
								</span>
								<span className="text-xs text-muted-foreground">
									({formatPercent(item.value)})
								</span>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
