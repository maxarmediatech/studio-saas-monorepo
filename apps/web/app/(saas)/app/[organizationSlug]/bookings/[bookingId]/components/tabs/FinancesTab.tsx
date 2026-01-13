"use client";

import { Badge } from "@repo/ui/components/badge";
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
import { CalendarIcon, PlusIcon } from "lucide-react";
import { formatCurrency } from "../utils";

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

const methodLabels: Record<PaymentMethod, string> = {
	cash: "Cash",
	upi: "UPI",
	bank_transfer: "Bank",
	cheque: "Cheque",
	card: "Card",
	other: "Other",
};

function PaymentRow({
	amount,
	date,
	method,
	reference,
	onEdit,
}: {
	amount: string;
	date: string;
	method?: string;
	reference?: string | null;
	onEdit: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onEdit}
			className="w-full flex items-center justify-between gap-4 py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
		>
			<div className="flex-1 min-w-0 space-y-0.5">
				<div className="flex items-center gap-2">
					<span className="font-medium text-emerald-600">
						+{formatCurrency(amount)}
					</span>
					{method && (
						<Badge variant="secondary" className="text-[10px] h-5">
							{methodLabels[method as PaymentMethod] || method}
						</Badge>
					)}
				</div>
				<div className="text-xs text-muted-foreground">
					{format(new Date(date), "MMM d, yyyy")}
					{reference && ` · ${reference}`}
				</div>
			</div>
		</button>
	);
}

function ScheduleRow({
	amount,
	dueDate,
	onEdit,
}: {
	amount: string;
	dueDate: string;
	onEdit: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onEdit}
			className="w-full flex items-center justify-between gap-4 py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
		>
			<div className="flex-1 min-w-0 space-y-0.5">
				<span className="font-medium">{formatCurrency(amount)}</span>
				<div className="flex items-center gap-1 text-xs text-muted-foreground">
					<CalendarIcon className="h-3 w-3" />
					Due {format(new Date(dueDate), "MMM d, yyyy")}
				</div>
			</div>
		</button>
	);
}

function ExpenseRow({
	amount,
	category,
	description,
	date,
	onEdit,
}: {
	amount: string;
	category?: string | null;
	description?: string | null;
	date?: string | null;
	onEdit: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onEdit}
			className="w-full flex items-center justify-between gap-4 py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
		>
			<div className="flex-1 min-w-0 space-y-0.5">
				<div className="flex items-center gap-2">
					<span className="font-medium text-rose-600">
						-{formatCurrency(amount)}
					</span>
					{category && (
						<Badge variant="outline" className="text-[10px] h-5">
							{category}
						</Badge>
					)}
				</div>
				{(description || date) && (
					<div className="text-xs text-muted-foreground truncate">
						{description}
						{description && date && " · "}
						{date && format(new Date(date), "MMM d")}
					</div>
				)}
			</div>
		</button>
	);
}

function PaymentsList({ bookingId }: { bookingId: string }) {
	const { openCreate, openEdit } = usePaymentParams();

	const { data, isLoading, isError, refetch } = useQuery({
		...studioPaymentsApi.listReceivedOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const payments = data?.data ?? [];

	if (isLoading) {
		return <Skeleton className="h-16 w-full" />;
	}

	if (isError) {
		return (
			<div className="text-sm text-muted-foreground py-4">
				Failed to load.{" "}
				<button
					type="button"
					onClick={() => refetch()}
					className="underline"
				>
					Retry
				</button>
			</div>
		);
	}

	if (payments.length === 0) {
		return (
			<div className="text-sm text-muted-foreground py-4">
				No payments recorded.{" "}
				<button
					type="button"
					onClick={() => openCreate()}
					className="underline"
				>
					Add one
				</button>
			</div>
		);
	}

	return (
		<div className="divide-y">
			{payments.map((p) => (
				<PaymentRow
					key={p.id}
					amount={p.amount}
					date={p.receivedDate}
					method={p.paymentMethod}
					reference={p.transactionReference}
					onEdit={() => openEdit(p.id)}
				/>
			))}
		</div>
	);
}

function SchedulesList({ bookingId }: { bookingId: string }) {
	const { openCreate, openEdit } = useScheduleParams();

	const { data, isLoading, isError, refetch } = useQuery({
		...studioPaymentsApi.listSchedulesOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const schedules = data?.data ?? [];

	if (isLoading) {
		return <Skeleton className="h-16 w-full" />;
	}

	if (isError) {
		return (
			<div className="text-sm text-muted-foreground py-4">
				Failed to load.{" "}
				<button
					type="button"
					onClick={() => refetch()}
					className="underline"
				>
					Retry
				</button>
			</div>
		);
	}

	if (schedules.length === 0) {
		return (
			<div className="text-sm text-muted-foreground py-4">
				No scheduled payments.{" "}
				<button
					type="button"
					onClick={() => openCreate()}
					className="underline"
				>
					Schedule one
				</button>
			</div>
		);
	}

	return (
		<div className="divide-y">
			{schedules.map((s) => (
				<ScheduleRow
					key={s.id}
					amount={s.amount}
					dueDate={s.dueDate}
					onEdit={() => openEdit(s.id)}
				/>
			))}
		</div>
	);
}

function ExpensesList({ bookingId }: { bookingId: string }) {
	const { openCreate, openEdit } = useExpenseParams();

	const { data, isLoading, isError, refetch } = useQuery({
		...expensesApi.listOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const expenses = data?.data ?? [];

	if (isLoading) {
		return <Skeleton className="h-16 w-full" />;
	}

	if (isError) {
		return (
			<div className="text-sm text-muted-foreground py-4">
				Failed to load.{" "}
				<button
					type="button"
					onClick={() => refetch()}
					className="underline"
				>
					Retry
				</button>
			</div>
		);
	}

	if (expenses.length === 0) {
		return (
			<div className="text-sm text-muted-foreground py-4">
				No expenses recorded.{" "}
				<button
					type="button"
					onClick={() => openCreate()}
					className="underline"
				>
					Add one
				</button>
			</div>
		);
	}

	return (
		<div className="divide-y">
			{expenses.map((e) => (
				<ExpenseRow
					key={e.id}
					amount={e.amount}
					category={e.category}
					description={e.description}
					date={e.expenseDate}
					onEdit={() => openEdit(e.id)}
				/>
			))}
		</div>
	);
}

export function FinancesTab({
	bookingId,
	packageCost,
	totalReceived,
	balance,
}: FinancesTabProps) {
	const { openCreate: openCreatePayment } = usePaymentParams();
	const { openCreate: openCreateSchedule } = useScheduleParams();
	const { openCreate: openCreateExpense } = useExpenseParams();

	const { data: expenses } = useQuery({
		...expensesApi.listOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const totalExpenses =
		expenses?.data?.reduce(
			(sum, e) => sum + (Number.parseFloat(e.amount) || 0),
			0,
		) ?? 0;

	const packageCostNum = Number.parseFloat(packageCost) || 0;
	const netProfit = packageCostNum - totalExpenses;
	const balanceNum = Number.parseFloat(balance) || 0;

	return (
		<div className="space-y-8">
			<div>
				<h3 className="font-bold text-2xl mb-2">Finances</h3>
				<p className="text-muted-foreground mb-6">
					Payments, expenses, and financial summary.
				</p>
			</div>
			<div className="flex items-center justify-between py-3 border-b">
				<div className="space-y-0.5">
					<div className="text-sm text-muted-foreground">
						Net Profit
					</div>
					<div
						className={cn(
							"text-xl font-semibold",
							netProfit >= 0
								? "text-emerald-600"
								: "text-rose-600",
						)}
					>
						{formatCurrency(netProfit)}
					</div>
				</div>
				<div className="space-y-0.5 text-right">
					<div className="text-sm text-muted-foreground">
						Total Expenses
					</div>
					<div className="text-xl font-semibold text-rose-600">
						{formatCurrency(totalExpenses)}
					</div>
				</div>
			</div>

			<div>
				<div className="flex items-center justify-between mb-3">
					<h4 className="text-sm font-medium">Payments Received</h4>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 text-xs"
						onClick={() => openCreatePayment()}
					>
						<PlusIcon className="h-3.5 w-3.5 mr-1" />
						Add
					</Button>
				</div>
				<PaymentsList bookingId={bookingId} />
			</div>

			<div>
				<div className="flex items-center justify-between mb-3">
					<h4 className="text-sm font-medium">Scheduled Payments</h4>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 text-xs"
						onClick={() => openCreateSchedule()}
					>
						<PlusIcon className="h-3.5 w-3.5 mr-1" />
						Schedule
					</Button>
				</div>
				<SchedulesList bookingId={bookingId} />
			</div>

			<div>
				<div className="flex items-center justify-between mb-3">
					<h4 className="text-sm font-medium">Expenses</h4>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 text-xs"
						onClick={() => openCreateExpense()}
					>
						<PlusIcon className="h-3.5 w-3.5 mr-1" />
						Add
					</Button>
				</div>
				<ExpensesList bookingId={bookingId} />
			</div>
		</div>
	);
}
