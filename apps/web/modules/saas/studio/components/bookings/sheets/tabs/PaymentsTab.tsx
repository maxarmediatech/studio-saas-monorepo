"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Progress } from "@repo/ui/components/progress";
import { Skeleton } from "@repo/ui/components/skeleton";
import { formatMoney } from "@saas/shared/lib";
import { studioPaymentsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircleIcon, WalletIcon } from "lucide-react";
import { memo } from "react";

interface PaymentsTabProps {
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

export const PaymentsTab = memo(function PaymentsTab({
	bookingId,
	packageCost,
	totalReceived,
	balance,
}: PaymentsTabProps) {
	const {
		data: payments,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...studioPaymentsApi.listReceivedOptions({ bookingId, limit: 50 }),
		enabled: !!bookingId,
	});

	// Calculate progress percentage
	const packageCostNum = Number.parseFloat(packageCost);
	const totalReceivedNum = Number.parseFloat(totalReceived);
	const progressPercentage =
		packageCostNum > 0 ? (totalReceivedNum / packageCostNum) * 100 : 0;

	if (isLoading) {
		return (
			<div className="space-y-6">
				{/* Progress section skeleton */}
				<div className="space-y-2">
					<Skeleton className="h-2 w-full" />
					<Skeleton className="h-4 w-48" />
					<Skeleton className="h-4 w-32" />
				</div>

				{/* Header skeleton */}
				<div className="flex items-center justify-between">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-9 w-32" />
				</div>

				{/* List skeleton */}
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={i}
							className="flex items-center justify-between border rounded-lg p-4"
						>
							<div className="space-y-2 flex-1">
								<Skeleton className="h-5 w-32" />
								<Skeleton className="h-4 w-48" />
							</div>
							<Skeleton className="h-9 w-9" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center gap-2 py-8 text-center">
				<AlertCircleIcon className="h-10 w-10 text-destructive/50" />
				<p className="text-sm text-destructive">
					Failed to load payments
				</p>
				<Button variant="outline" size="sm" onClick={() => refetch()}>
					Try again
				</Button>
			</div>
		);
	}

	const paymentsList = payments?.data ?? [];

	return (
		<div className="space-y-6">
			{/* Payment Progress Section */}
			<div className="space-y-3">
				<div className="space-y-2">
					<Progress value={progressPercentage} className="h-2" />
					<div className="flex items-center justify-between text-sm">
						<p className="text-muted-foreground">
							{formatMoney(totalReceived)} of{" "}
							{formatMoney(packageCost)} received (
							{progressPercentage.toFixed(1)}%)
						</p>
					</div>
					<div className="text-sm">
						<span className="text-muted-foreground">Balance: </span>
						<span
							className={
								Number.parseFloat(balance) > 0
									? "text-destructive font-medium"
									: "text-green-600 font-medium"
							}
						>
							{formatMoney(balance)}
						</span>
					</div>
				</div>
			</div>

			{/* Header */}
			<div>
				<h3 className="text-lg font-medium">Received Payments</h3>
			</div>

			{/* List of received payments */}
			{paymentsList.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-8 text-center">
					<WalletIcon className="h-10 w-10 text-muted-foreground/50" />
					<p className="text-sm text-muted-foreground">
						No payments recorded
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{paymentsList.map((payment) => (
						<div key={payment.id} className="border rounded-lg p-4">
							<div className="space-y-2">
								<div className="flex items-center gap-3">
									<span className="text-lg font-semibold">
										{formatMoney(payment.amount)}
									</span>
									<Badge
										variant={
											paymentMethodColors[
												payment.paymentMethod as PaymentMethod
											]
										}
									>
										{
											paymentMethodLabels[
												payment.paymentMethod as PaymentMethod
											]
										}
									</Badge>
								</div>
								<div className="text-sm text-muted-foreground space-y-1">
									<p>
										Received:{" "}
										{format(
											new Date(payment.receivedDate),
											"MMM dd, yyyy",
										)}
									</p>
									{payment.transactionReference && (
										<p>
											Reference:{" "}
											{payment.transactionReference}
										</p>
									)}
									{payment.notes && (
										<p className="text-xs mt-1">
											{payment.notes}
										</p>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
});
