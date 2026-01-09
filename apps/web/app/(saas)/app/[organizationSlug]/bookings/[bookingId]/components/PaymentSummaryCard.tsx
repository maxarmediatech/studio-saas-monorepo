"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Progress } from "@repo/ui/components/progress";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { usePaymentParams } from "@saas/studio/hooks/params";
import { studioPaymentsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	AlertCircleIcon,
	PencilIcon,
	PlusIcon,
	WalletIcon,
} from "lucide-react";

type PaymentMethod =
	| "cash"
	| "upi"
	| "bank_transfer"
	| "cheque"
	| "card"
	| "other";

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

interface PaymentSummaryCardProps {
	bookingId: string;
	packageCost: string;
	totalReceived: string;
	balance: string;
	className?: string;
}

const formatCurrency = (amount: number | string) => {
	const num =
		typeof amount === "string" ? Number.parseFloat(amount) || 0 : amount;
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(num);
};

/**
 * Displays payment summary and history for a booking
 * Shows financial overview, progress, and payment list
 */
export function PaymentSummaryCard({
	bookingId,
	packageCost,
	totalReceived,
	balance,
	className,
}: PaymentSummaryCardProps) {
	const { openCreate, openEdit } = usePaymentParams();

	const {
		data: payments,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...studioPaymentsApi.listReceivedOptions({ bookingId, limit: 50 }),
		enabled: !!bookingId,
	});

	const paymentsList = payments?.data ?? [];
	const count = paymentsList.length;

	// Calculate progress
	const packageCostNum = Number.parseFloat(packageCost);
	const totalReceivedNum = Number.parseFloat(totalReceived);
	const balanceNum = Number.parseFloat(balance);
	const progressPercentage =
		packageCostNum > 0 ? (totalReceivedNum / packageCostNum) * 100 : 0;
	const isPaid = balanceNum <= 0;

	return (
		<Card className={cn("shadow-none", className)}>
			<CardContent className="p-0">
				{/* Header */}
				<div className="flex items-center justify-between p-4 pb-3 border-b">
					<div className="flex items-center gap-2">
						<WalletIcon className="h-4 w-4 text-muted-foreground" />
						<h3 className="text-sm font-medium">Payment Details</h3>
						<Badge
							variant="outline"
							className={cn(
								"text-xs",
								isPaid
									? "bg-green-50 text-green-700 border-green-200"
									: "bg-amber-50 text-amber-700 border-amber-200",
							)}
						>
							{isPaid ? "Paid" : "Pending"}
						</Badge>
					</div>
					<Button
						variant="ghost"
						size="sm"
						className="h-7"
						onClick={() => openCreate()}
					>
						<PlusIcon className="h-3 w-3 mr-1" />
						Record Payment
					</Button>
				</div>

				{/* Financial Summary */}
				<div className="p-4 border-b bg-muted/30">
					<div className="grid grid-cols-3 gap-4 text-center">
						<div>
							<p className="text-xs text-muted-foreground">Package Cost</p>
							<p className="text-lg font-semibold">
								{formatCurrency(packageCost)}
							</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground">Received</p>
							<p className="text-lg font-semibold text-green-600">
								{formatCurrency(totalReceived)}
							</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground">Balance</p>
							<p
								className={cn(
									"text-lg font-semibold",
									balanceNum > 0 ? "text-amber-600" : "text-green-600",
								)}
							>
								{formatCurrency(balance)}
							</p>
						</div>
					</div>

					{/* Progress bar */}
					<div className="mt-3 space-y-1">
						<Progress value={Math.min(progressPercentage, 100)} className="h-1.5" />
						<p className="text-xs text-muted-foreground text-right">
							{progressPercentage.toFixed(0)}% paid
						</p>
					</div>
				</div>

				{/* Payment History */}
				<div className="p-4">
					{isLoading ? (
						<div className="space-y-3">
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
						</div>
					) : isError ? (
						<div className="flex flex-col items-center gap-2 py-6 text-center">
							<AlertCircleIcon className="h-8 w-8 text-destructive/50" />
							<p className="text-sm text-destructive">
								Failed to load payments
							</p>
							<Button variant="outline" size="sm" onClick={() => refetch()}>
								Try again
							</Button>
						</div>
					) : paymentsList.length === 0 ? (
						<div className="flex flex-col items-center gap-2 py-6 text-center">
							<WalletIcon className="h-8 w-8 text-muted-foreground/50" />
							<p className="text-sm text-muted-foreground">
								No payments recorded
							</p>
							<Button
								variant="outline"
								size="sm"
								onClick={() => openCreate()}
							>
								<PlusIcon className="h-4 w-4 mr-2" />
								Record Payment
							</Button>
						</div>
					) : (
						<div className="space-y-3">
							<p className="text-xs font-medium text-muted-foreground">
								Payment History ({count})
							</p>
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
												{format(
													new Date(payment.receivedDate),
													"MMM d, yyyy",
												)}
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
					)}
				</div>
			</CardContent>
		</Card>
	);
}
