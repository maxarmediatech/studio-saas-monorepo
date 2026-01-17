"use client";

import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import {
	useExpenseParams,
	usePaymentParams,
	useScheduleParams,
} from "@saas/studio/hooks/params";
import { expensesApi, studioPaymentsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowDownIcon, ArrowUpIcon, ClockIcon, PlusIcon } from "lucide-react";
import { Fragment } from "react";
import { formatCurrency } from "../utils";

interface FinancesTabProps {
	bookingId: string;
}

const statuses = {
	paid: "text-green-700 bg-green-50 ring-green-600/20 dark:text-green-400 dark:bg-green-950 dark:ring-green-500/20",
	pending:
		"text-yellow-700 bg-yellow-50 ring-yellow-600/20 dark:text-yellow-400 dark:bg-yellow-950 dark:ring-yellow-500/20",
	overdue:
		"text-red-700 bg-red-50 ring-red-600/10 dark:text-red-400 dark:bg-red-950 dark:ring-red-500/20",
	expense:
		"text-gray-600 bg-gray-50 ring-gray-500/10 dark:text-gray-400 dark:bg-gray-900 dark:ring-gray-500/20",
} as const;

export function FinancesTab({ bookingId }: FinancesTabProps) {
	const { openCreate: openCreatePayment, openEdit: openEditPayment } =
		usePaymentParams();
	const { openCreate: openCreateSchedule, openEdit: openEditSchedule } =
		useScheduleParams();
	const { openCreate: openCreateExpense, openEdit: openEditExpense } =
		useExpenseParams();

	const {
		data: paymentsData,
		isLoading: paymentsLoading,
		isError: paymentsError,
		refetch: refetchPayments,
	} = useQuery({
		...studioPaymentsApi.listReceivedOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const {
		data: schedulesData,
		isLoading: schedulesLoading,
		isError: schedulesError,
		refetch: refetchSchedules,
	} = useQuery({
		...studioPaymentsApi.listSchedulesOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const {
		data: expensesData,
		isLoading: expensesLoading,
		isError: expensesError,
		refetch: refetchExpenses,
	} = useQuery({
		...expensesApi.listOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const payments = paymentsData?.data ?? [];
	const schedules = schedulesData?.data ?? [];
	const expenses = expensesData?.data ?? [];

	const isLoading = paymentsLoading || schedulesLoading || expensesLoading;

	if (isLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-24 w-full" />
			</div>
		);
	}

	const sections = [
		{
			id: "payments",
			label: "Payments Received",
			count: payments.length,
			onAdd: openCreatePayment,
			addLabel: "Add",
			isError: paymentsError,
			refetch: refetchPayments,
			emptyText: "No payments recorded",
			emptyAction: "Add one",
		},
		{
			id: "schedules",
			label: "Scheduled Payments",
			count: schedules.length,
			onAdd: openCreateSchedule,
			addLabel: "Schedule",
			isError: schedulesError,
			refetch: refetchSchedules,
			emptyText: "No scheduled payments",
			emptyAction: "Schedule one",
		},
		{
			id: "expenses",
			label: "Expenses",
			count: expenses.length,
			onAdd: openCreateExpense,
			addLabel: "Add",
			isError: expensesError,
			refetch: refetchExpenses,
			emptyText: "No expenses recorded",
			emptyAction: "Add one",
		},
	] as const;

	return (
		<div className="border-t border-border">
				<table className="w-full text-left">
					<thead className="sr-only">
						<tr>
							<th>Amount</th>
							<th>Date</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{sections.map((section) => (
							<Fragment key={section.id}>
								<tr className="text-sm text-foreground bg-muted/50">
									<th
										scope="colgroup"
										colSpan={3}
										className="py-2 font-semibold border-b border-border"
									>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<span>{section.label}</span>
												{section.count > 0 && (
													<span className="text-muted-foreground font-normal">
														({section.count})
													</span>
												)}
											</div>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 text-xs"
												onClick={() => section.onAdd()}
											>
												<PlusIcon className="h-3.5 w-3.5 mr-1" />
												{section.addLabel}
											</Button>
										</div>
									</th>
								</tr>

								{section.isError ? (
									<tr>
										<td colSpan={3} className="py-4">
											<div className="text-sm text-muted-foreground">
												Failed to load.{" "}
												<button
													type="button"
													onClick={() =>
														section.refetch()
													}
													className="underline hover:text-foreground"
												>
													Retry
												</button>
											</div>
										</td>
									</tr>
								) : (section.id === "payments" &&
										payments.length === 0) ||
									(section.id === "schedules" &&
										schedules.length === 0) ||
									(section.id === "expenses" &&
										expenses.length === 0) ? (
									<tr>
										<td colSpan={3} className="py-4">
											<div className="text-sm text-muted-foreground">
												{section.emptyText}.{" "}
												<button
													type="button"
													onClick={() =>
														section.onAdd()
													}
													className="underline hover:text-foreground"
												>
													{section.emptyAction}
												</button>
											</div>
										</td>
									</tr>
								) : (
									<>
										{section.id === "payments" &&
											payments.map((payment) => (
												<tr
													key={payment.id}
													className="border-b border-border/50"
												>
													<td className="py-4 pr-6">
														<div className="flex items-center gap-3">
															<ArrowDownIcon className="h-4 w-4 text-muted-foreground" />
															<div className="flex items-center gap-2">
																<span className="text-sm font-medium">
																	{formatCurrency(
																		payment.amount,
																	)}
																</span>
																<div
																	className={cn(
																		statuses.paid,
																		"rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
																	)}
																>
																	Paid
																</div>
															</div>
														</div>
													</td>
													<td className="py-4 pr-6">
														<span className="text-sm text-muted-foreground">
															{format(
																new Date(
																	payment.receivedDate,
																),
																"MMM d, yyyy",
															)}
														</span>
													</td>
													<td className="py-4 text-right">
														<button
															type="button"
															onClick={() =>
																openEditPayment(
																	payment.id,
																)
															}
															className="text-sm font-medium text-primary hover:text-primary/80"
														>
															View
														</button>
													</td>
												</tr>
											))}

										{section.id === "schedules" &&
											schedules.map((schedule) => (
												<tr
													key={schedule.id}
													className="border-b border-border/50"
												>
													<td className="py-4 pr-6">
														<div className="flex items-center gap-3">
															<ClockIcon className="h-4 w-4 text-muted-foreground" />
															<div className="flex items-center gap-2">
																<span className="text-sm font-medium">
																	{formatCurrency(
																		schedule.amount,
																	)}
																</span>
																<div
																	className={cn(
																		statuses.pending,
																		"rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
																	)}
																>
																	Pending
																</div>
															</div>
														</div>
													</td>
													<td className="py-4 pr-6">
														<span className="text-sm text-muted-foreground">
															Due{" "}
															{format(
																new Date(
																	schedule.dueDate,
																),
																"MMM d, yyyy",
															)}
														</span>
													</td>
													<td className="py-4 text-right">
														<button
															type="button"
															onClick={() =>
																openEditSchedule(
																	schedule.id,
																)
															}
															className="text-sm font-medium text-primary hover:text-primary/80"
														>
															Edit
														</button>
													</td>
												</tr>
											))}

										{section.id === "expenses" &&
											expenses.map((expense) => (
												<tr
													key={expense.id}
													className="border-b border-border/50"
												>
													<td className="py-4 pr-6">
														<div className="flex items-center gap-3">
															<ArrowUpIcon className="h-4 w-4 text-muted-foreground" />
															<div className="flex items-center gap-2">
																<span className="text-sm font-medium">
																	{formatCurrency(
																		expense.amount,
																	)}
																</span>
																<div
																	className={cn(
																		statuses.expense,
																		"rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
																	)}
																>
																	{expense.category ||
																		"Expense"}
																</div>
															</div>
														</div>
													</td>
													<td className="py-4 pr-6">
														<span className="text-sm text-muted-foreground">
															{expense.expenseDate
																? format(
																		new Date(
																			expense.expenseDate,
																		),
																		"MMM d, yyyy",
																	)
																: "—"}
														</span>
													</td>
													<td className="py-4 text-right">
														<button
															type="button"
															onClick={() =>
																openEditExpense(
																	expense.id,
																)
															}
															className="text-sm font-medium text-primary hover:text-primary/80"
														>
															View
														</button>
													</td>
												</tr>
											))}
									</>
								)}
							</Fragment>
						))}
					</tbody>
				</table>
		</div>
	);
}
