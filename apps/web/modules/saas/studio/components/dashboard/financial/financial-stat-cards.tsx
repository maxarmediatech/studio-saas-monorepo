"use client";

import { Card, CardContent } from "@repo/ui/components/card";
import {
	ArrowDownIcon,
	DollarSignIcon,
	ReceiptIcon,
	TrendingUpIcon,
	WalletIcon,
} from "lucide-react";

interface FinancialStatCardsProps {
	revenue: string;
	collected: string;
	totalExpenses: string;
	netProfit: number;
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	maximumFractionDigits: 0,
});

export function FinancialStatCards({
	revenue,
	collected,
	totalExpenses,
	netProfit,
}: FinancialStatCardsProps) {
	const formatCurrency = (value: number) => currencyFormatter.format(value);

	const revenueNum = Number.parseFloat(revenue) || 0;
	const collectedNum = Number.parseFloat(collected) || 0;
	const expensesNum = Number.parseFloat(totalExpenses) || 0;

	const stats = [
		{
			label: "Booked Value",
			value: formatCurrency(revenueNum),
			icon: DollarSignIcon,
			iconColor: "text-blue-500",
			bgColor: "bg-blue-500/10",
		},
		{
			label: "Collected",
			value: formatCurrency(collectedNum),
			icon: WalletIcon,
			iconColor: "text-green-500",
			bgColor: "bg-green-500/10",
		},
		{
			label: "Expenses",
			value: formatCurrency(expensesNum),
			icon: ReceiptIcon,
			iconColor: "text-orange-500",
			bgColor: "bg-orange-500/10",
		},
		{
			label: "Net Cash",
			value: formatCurrency(netProfit),
			icon: netProfit >= 0 ? TrendingUpIcon : ArrowDownIcon,
			iconColor: netProfit >= 0 ? "text-emerald-500" : "text-red-500",
			bgColor: netProfit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
			valueColor: netProfit >= 0 ? "text-emerald-600" : "text-red-600",
		},
	];

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{stats.map((stat) => (
				<Card key={stat.label}>
					<CardContent className="flex items-center gap-4 p-4">
						<div className={`rounded-lg p-2 ${stat.bgColor}`}>
							<stat.icon className={`size-5 ${stat.iconColor}`} />
						</div>
						<div className="flex-1">
							<p className="text-sm text-muted-foreground">
								{stat.label}
							</p>
							<p
								className={`text-xl font-semibold ${stat.valueColor || ""}`}
							>
								{stat.value}
							</p>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
