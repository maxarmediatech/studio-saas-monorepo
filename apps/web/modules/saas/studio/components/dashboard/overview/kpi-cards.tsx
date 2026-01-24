"use client";

import type { FinancialSummary } from "@repo/api/modules/studio/schemas/dashboard";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	BanknoteIcon,
	ClockIcon,
	TrendingUpIcon,
	WalletIcon,
} from "lucide-react";

interface KpiCardsProps {
	financial: FinancialSummary;
	isLoading?: boolean;
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	maximumFractionDigits: 0,
});

function formatCurrency(value: string): string {
	const num = Number.parseFloat(value);
	return currencyFormatter.format(num);
}

export function KpiCards({ financial, isLoading }: KpiCardsProps) {
	const cards = [
		{
			title: "Total Revenue",
			value: formatCurrency(financial.totalRevenue),
			subtitle: "This period",
			icon: BanknoteIcon,
			iconBg: "bg-green-100",
			iconColor: "text-green-600",
		},
		{
			title: "Collected",
			value: formatCurrency(financial.totalReceived),
			subtitle: `${financial.collectionRate.toFixed(0)}% collection rate`,
			icon: WalletIcon,
			iconBg: "bg-blue-100",
			iconColor: "text-blue-600",
		},
		{
			title: "Pending",
			value: formatCurrency(financial.totalPending),
			subtitle: "Outstanding amount",
			icon: ClockIcon,
			iconBg: "bg-amber-100",
			iconColor: "text-amber-600",
		},
		{
			title: "Net Profit",
			value: formatCurrency(financial.netProfit),
			subtitle: `₹${formatCurrency(financial.totalExpenses).replace("₹", "")} expenses`,
			icon: TrendingUpIcon,
			iconBg: "bg-purple-100",
			iconColor: "text-purple-600",
		},
	];

	if (isLoading) {
		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-24 rounded-lg" />
				))}
			</div>
		);
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{cards.map((card) => {
				const Icon = card.icon;
				return (
					<Card key={card.title}>
						<CardContent className="p-4">
							<div className="flex items-start justify-between">
								<div className="space-y-1">
									<p className="text-sm font-medium text-muted-foreground">
										{card.title}
									</p>
									<p className="text-2xl font-bold">
										{card.value}
									</p>
									<p className="text-xs text-muted-foreground">
										{card.subtitle}
									</p>
								</div>
								<div
									className={`rounded-lg p-2 ${card.iconBg}`}
								>
									<Icon
										className={`size-5 ${card.iconColor}`}
									/>
								</div>
							</div>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
