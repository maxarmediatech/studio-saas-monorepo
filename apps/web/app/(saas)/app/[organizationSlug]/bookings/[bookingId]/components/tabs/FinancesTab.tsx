"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Progress } from "@repo/ui/components/progress";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	CustomTabsContent,
	CustomTabsList,
	CustomTabsTrigger,
	Tabs,
} from "@repo/ui/components/tabs";
import { cn } from "@repo/ui/lib/utils";
import {
	useExpenseParams,
	usePaymentParams,
	useScheduleParams,
} from "@saas/studio/hooks/params";
import {
	expensesApi,
	studioPaymentsApi,
} from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	AlertCircleIcon,
	CalendarIcon,
	IndianRupee,
	PencilIcon,
	PlusIcon,
	ReceiptIcon,
	WalletIcon,
} from "lucide-react";
import { formatCurrency } from "../utils";

// ============================================================================
// Types
// ============================================================================

interface FinancesTabProps {
	bookingId: string;
	packageCost: string;
	totalReceived: string;
	balance: string;
}

type PaymentMethod =
	| "cash"
	| "upi"
	| "bank_transfer"
	| "cheque"
	| "card"
	| "other";

// ============================================================================
// Constants
// ============================================================================

const paymentMethodColors: Record<
	PaymentMethod,
	"default" | "secondary" | "destructive" | "outline"
> = {
	cash: "default",
	upi: "secondary",
	bank_transfer: "outline",
	cheque: "secondary",
	card: "default",
	other: "outline",
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
	cash: "Cash",
	upi: "UPI",
	bank_transfer: "Bank Transfer",
	cheque: "Cheque",
	card: "Card",
	other: "Other",
};

// ============================================================================
// Sub-Components
// ============================================================================

function KeyMetrics({
	packageCost,
	totalReceived,
	balance,
	totalExpenses,
}: {
	packageCost: string;
	totalReceived: string;
	balance: string;
	totalExpenses: number;
}) {
	const packageCostNum = Number.parseFloat(packageCost) || 0;
	const balanceNum = Number.parseFloat(balance) || 0;
	const netProfit = packageCostNum - totalExpenses;
	const profitMargin =
		packageCostNum > 0 ? (netProfit / packageCostNum) * 100 : 0;
	const expensePercent =
		packageCostNum > 0 ? (totalExpenses / packageCostNum) * 100 : 0;

	return (
		<Card>
			<CardContent className="pt-6">
				<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Total Package</p>
						<p className="text-xl font-semibold">
							{formatCurrency(packageCost)}
						</p>
					</div>
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Total Expenses</p>
						<p className="text-xl font-semibold text-amber-600">
							{formatCurrency(totalExpenses)}
							<span className="text-xs font-normal text-muted-foreground ml-1">
								({expensePercent.toFixed(0)}%)
							</span>
						</p>
					</div>
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Net Profit</p>
						<p
							className={cn(
								"text-xl font-semibold",
								netProfit >= 0 ? "text-green-600" : "text-red-600",
							)}
						>
							{formatCurrency(netProfit)}
							<span className="text-xs font-normal text-muted-foreground ml-1">
								({profitMargin.toFixed(0)}%)
							</span>
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function PaymentProgress({
	packageCost,
	totalReceived,
	balance,
}: {
	packageCost: string;
	totalReceived: string;
	balance: string;
}) {
	const packageCostNum = Number.parseFloat(packageCost) || 0;
	const totalReceivedNum = Number.parseFloat(totalReceived) || 0;
	const balanceNum = Number.parseFloat(balance) || 0;
	const progressPercentage =
		packageCostNum > 0
			? Math.min((totalReceivedNum / packageCostNum) * 100, 100)
			: 0;
	const isPaid = balanceNum <= 0;

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base">Payment Progress</CardTitle>
					<Badge
						variant="outline"
						className={cn(
							"text-xs",
							isPaid
								? "bg-green-50 text-green-700 border-green-200"
								: "bg-amber-50 text-amber-700 border-amber-200",
						)}
					>
						{isPaid ? "Fully Paid" : "Pending"}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Stacked bar showing received vs pending */}
				<div className="relative h-4 rounded-full overflow-hidden bg-muted">
					<div
						className="absolute inset-y-0 left-0 bg-green-500 transition-all"
						style={{ width: `${progressPercentage}%` }}
					/>
				</div>

				<div className="flex justify-between text-sm">
					<div className="flex items-center gap-2">
						<div className="h-3 w-3 rounded-full bg-green-500" />
						<span className="text-muted-foreground">Received:</span>
						<span className="font-medium text-green-600">
							{formatCurrency(totalReceived)}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="h-3 w-3 rounded-full bg-muted" />
						<span className="text-muted-foreground">Pending:</span>
						<span
							className={cn(
								"font-medium",
								balanceNum > 0 ? "text-amber-600" : "text-green-600",
							)}
						>
							{formatCurrency(balance)}
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function ReceivedPaymentsList({ bookingId }: { bookingId: string }) {
	const { openCreate, openEdit } = usePaymentParams();

	const {
		data: payments,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...studioPaymentsApi.listReceivedOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const paymentsList = payments?.data ?? [];

	if (isLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center gap-2 py-6 text-center">
				<AlertCircleIcon className="h-8 w-8 text-destructive/50" />
				<p className="text-sm text-destructive">Failed to load payments</p>
				<Button variant="outline" size="sm" onClick={() => refetch()}>
					Try again
				</Button>
			</div>
		);
	}

	if (paymentsList.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 py-8 text-center">
				<WalletIcon className="h-8 w-8 text-muted-foreground/50" />
				<p className="text-sm text-muted-foreground">No payments recorded</p>
				<Button variant="outline" size="sm" onClick={() => openCreate()}>
					<PlusIcon className="h-4 w-4 mr-2" />
					Record Payment
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{paymentsList.map((payment) => (
				<div
					key={payment.id}
					className="flex items-center justify-between rounded-lg border bg-background p-3 hover:bg-muted/50 transition-colors"
				>
					<div className="flex-1 space-y-1 min-w-0">
						<div className="flex items-center gap-2">
							<span className="font-semibold">
								{formatCurrency(payment.amount)}
							</span>
							<Badge
								variant={
									paymentMethodColors[
										payment.paymentMethod as PaymentMethod
									] || "outline"
								}
								className="text-xs"
							>
								{paymentMethodLabels[
									payment.paymentMethod as PaymentMethod
								] || payment.paymentMethod}
							</Badge>
						</div>
						<div className="text-xs text-muted-foreground">
							<span>
								{format(new Date(payment.receivedDate), "MMM d, yyyy")}
							</span>
							{payment.transactionReference && (
								<span className="ml-2">
									• Ref: {payment.transactionReference}
								</span>
							)}
						</div>
						{payment.notes && (
							<p className="text-xs text-muted-foreground truncate">
								{payment.notes}
							</p>
						)}
					</div>

					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0"
						onClick={() => openEdit(payment.id)}
						aria-label="Edit payment"
					>
						<PencilIcon className="h-3.5 w-3.5" />
					</Button>
				</div>
			))}
		</div>
	);
}

function UpcomingPaymentsList({ bookingId }: { bookingId: string }) {
	const { openCreate, openEdit } = useScheduleParams();

	const {
		data: schedules,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...studioPaymentsApi.listSchedulesOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const schedulesList = schedules?.data ?? [];

	if (isLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center gap-2 py-6 text-center">
				<AlertCircleIcon className="h-8 w-8 text-destructive/50" />
				<p className="text-sm text-destructive">Failed to load schedules</p>
				<Button variant="outline" size="sm" onClick={() => refetch()}>
					Try again
				</Button>
			</div>
		);
	}

	if (schedulesList.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 py-8 text-center">
				<CalendarIcon className="h-8 w-8 text-muted-foreground/50" />
				<p className="text-sm text-muted-foreground">
					No upcoming payments scheduled
				</p>
				<Button variant="outline" size="sm" onClick={() => openCreate()}>
					<PlusIcon className="h-4 w-4 mr-2" />
					Schedule Payment
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{schedulesList.map((schedule) => (
				<div
					key={schedule.id}
					className="flex items-center justify-between rounded-lg border bg-background p-3 hover:bg-muted/50 transition-colors"
				>
					<div className="flex-1 space-y-1 min-w-0">
						<div className="flex items-center gap-2">
							<span className="font-semibold">
								{formatCurrency(schedule.amount)}
							</span>
							<Badge variant="secondary" className="text-xs">
								Scheduled
							</Badge>
						</div>
						<div className="flex items-center gap-1 text-xs text-muted-foreground">
							<CalendarIcon className="h-3 w-3" />
							<span>
								Due: {format(new Date(schedule.dueDate), "MMM d, yyyy")}
							</span>
						</div>
						{schedule.notes && (
							<p className="text-xs text-muted-foreground truncate">
								{schedule.notes}
							</p>
						)}
					</div>

					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0"
						onClick={() => openEdit(schedule.id)}
						aria-label="Edit schedule"
					>
						<PencilIcon className="h-3.5 w-3.5" />
					</Button>
				</div>
			))}
		</div>
	);
}

function ExpensesList({ bookingId }: { bookingId: string }) {
	const { openCreate, openEdit } = useExpenseParams();

	const {
		data: expenses,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...expensesApi.listOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const expensesList = expenses?.data ?? [];

	if (isLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center gap-2 py-6 text-center">
				<AlertCircleIcon className="h-8 w-8 text-destructive/50" />
				<p className="text-sm text-destructive">Failed to load expenses</p>
				<Button variant="outline" size="sm" onClick={() => refetch()}>
					Try again
				</Button>
			</div>
		);
	}

	if (expensesList.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 py-8 text-center">
				<ReceiptIcon className="h-8 w-8 text-muted-foreground/50" />
				<p className="text-sm text-muted-foreground">No expenses recorded</p>
				<Button variant="outline" size="sm" onClick={() => openCreate()}>
					<PlusIcon className="h-4 w-4 mr-2" />
					Add Expense
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{expensesList.map((expense) => (
				<div
					key={expense.id}
					className="flex items-center justify-between rounded-lg border bg-background p-3 hover:bg-muted/50 transition-colors"
				>
					<div className="flex-1 space-y-1 min-w-0">
						<div className="flex items-center gap-2">
							<span className="font-semibold">
								{formatCurrency(expense.amount)}
							</span>
							{expense.category && (
								<Badge variant="outline" className="text-xs">
									{expense.category}
								</Badge>
							)}
						</div>
						{expense.description && (
							<p className="text-sm">{expense.description}</p>
						)}
						{expense.expenseDate && (
							<div className="text-xs text-muted-foreground">
								{format(new Date(expense.expenseDate), "MMM d, yyyy")}
							</div>
						)}
					</div>

					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0"
						onClick={() => openEdit(expense.id)}
						aria-label="Edit expense"
					>
						<PencilIcon className="h-3.5 w-3.5" />
					</Button>
				</div>
			))}
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function FinancesTab({
	bookingId,
	packageCost,
	totalReceived,
	balance,
}: FinancesTabProps) {
	const { openCreate: openCreatePayment } = usePaymentParams();
	const { openCreate: openCreateSchedule } = useScheduleParams();
	const { openCreate: openCreateExpense } = useExpenseParams();

	// Fetch expenses for total calculation
	const { data: expenses } = useQuery({
		...expensesApi.listOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const totalExpenses =
		expenses?.data?.reduce(
			(sum, e) => sum + (Number.parseFloat(e.amount) || 0),
			0,
		) ?? 0;

	return (
		<div className="space-y-6">
			{/* Key Metrics */}
			<KeyMetrics
				packageCost={packageCost}
				totalReceived={totalReceived}
				balance={balance}
				totalExpenses={totalExpenses}
			/>

			{/* Payment Progress */}
			<PaymentProgress
				packageCost={packageCost}
				totalReceived={totalReceived}
				balance={balance}
			/>

			{/* Action Buttons */}
			<div className="flex flex-wrap gap-2">
				<Button variant="outline" size="sm" onClick={() => openCreatePayment()}>
					<PlusIcon className="h-4 w-4 mr-1" />
					Record Payment
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={() => openCreateSchedule()}
				>
					<CalendarIcon className="h-4 w-4 mr-1" />
					Schedule Payment
				</Button>
				<Button variant="outline" size="sm" onClick={() => openCreateExpense()}>
					<ReceiptIcon className="h-4 w-4 mr-1" />
					Add Expense
				</Button>
			</div>

			{/* Sub-tabs for different finance sections */}
			<Tabs defaultValue="received" className="space-y-4">
				<CustomTabsList>
					<CustomTabsTrigger value="received">
						<IndianRupee className="h-3.5 w-3.5 mr-1.5" />
						Received
					</CustomTabsTrigger>
					<CustomTabsTrigger value="upcoming">
						<CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
						Upcoming
					</CustomTabsTrigger>
					<CustomTabsTrigger value="expenses">
						<ReceiptIcon className="h-3.5 w-3.5 mr-1.5" />
						Expenses
					</CustomTabsTrigger>
				</CustomTabsList>

				<CustomTabsContent value="received">
					<ReceivedPaymentsList bookingId={bookingId} />
				</CustomTabsContent>

				<CustomTabsContent value="upcoming">
					<UpcomingPaymentsList bookingId={bookingId} />
				</CustomTabsContent>

				<CustomTabsContent value="expenses">
					<ExpensesList bookingId={bookingId} />
				</CustomTabsContent>
			</Tabs>
		</div>
	);
}
