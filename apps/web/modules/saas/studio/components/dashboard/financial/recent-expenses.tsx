"use client";

import type { ExpenseListItem } from "@repo/api/modules/studio/schemas/expense";
import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { format, parseISO } from "date-fns";
import { ArrowRightIcon, ReceiptIcon } from "lucide-react";
import Link from "next/link";

interface RecentExpensesProps {
	expenses: ExpenseListItem[];
	organizationSlug: string;
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	maximumFractionDigits: 0,
});

export function RecentExpenses({
	expenses,
	organizationSlug,
}: RecentExpensesProps) {
	const formatCurrency = (value: string) =>
		currencyFormatter.format(Number.parseFloat(value) || 0);

	const formatDate = (dateStr: string) => {
		try {
			return format(parseISO(dateStr), "MMM d, yyyy");
		} catch {
			return dateStr;
		}
	};

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-base font-medium">
					Recent Expenses
				</CardTitle>
			</CardHeader>
			<CardContent>
				{expenses.length === 0 ? (
					<div className="flex h-[150px] items-center justify-center text-sm text-muted-foreground">
						No expenses for this period
					</div>
				) : (
					<div className="space-y-3">
						{expenses.map((expense) => (
							<div
								key={expense.id}
								className="flex items-start justify-between gap-2 border-b pb-3 last:border-0 last:pb-0"
							>
								<div className="flex items-start gap-3">
									<div className="rounded-lg bg-orange-500/10 p-2">
										<ReceiptIcon className="size-4 text-orange-500" />
									</div>
									<div className="flex flex-col gap-0.5">
										<span className="text-sm font-medium line-clamp-1">
											{expense.description}
										</span>
										<div className="flex items-center gap-2 text-xs text-muted-foreground">
											<span>
												{formatDate(
													expense.expenseDate,
												)}
											</span>
											{expense.category && (
												<>
													<span>·</span>
													<Badge
														variant="secondary"
														className="text-xs"
													>
														{expense.category}
													</Badge>
												</>
											)}
										</div>
									</div>
								</div>
								<span className="font-medium tabular-nums">
									{formatCurrency(expense.amount)}
								</span>
							</div>
						))}
					</div>
				)}
			</CardContent>
			{expenses.length > 0 && (
				<CardFooter className="pt-0">
					<Link
						href={`/app/${organizationSlug}/expenses`}
						className="flex items-center gap-1 text-sm text-primary hover:underline"
					>
						View all expenses
						<ArrowRightIcon className="size-3" />
					</Link>
				</CardFooter>
			)}
		</Card>
	);
}
