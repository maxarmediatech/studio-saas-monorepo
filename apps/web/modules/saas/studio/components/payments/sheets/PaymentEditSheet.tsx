"use client";

import { Button } from "@repo/ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { usePaymentParams } from "@saas/studio/hooks/params/use-payment-params";
import {
	studioPaymentsApi,
	studioPaymentsMutations,
} from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PaymentForm, type PaymentFormValues } from "../PaymentForm";

export function PaymentEditSheet() {
	const { paymentId, close } = usePaymentParams();
	const isOpen = Boolean(paymentId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);
	const [isCorrecting, setIsCorrecting] = useState(false);
	const [correctionKey, setCorrectionKey] = useState("");

	const { data: payment, isLoading } = useQuery({
		...studioPaymentsApi.getReceivedOptions(paymentId ?? ""),
		enabled: isOpen && !!paymentId,
	});

	const updateMutation = useMutation(
		studioPaymentsMutations.updateReceived(),
	);
	const correctionMutation = useMutation(
		studioPaymentsMutations.correctReceived(),
	);
	const canEditFinancialDetails =
		payment?.data.financialProtection.canEditFinancialDetails ?? false;

	useEffect(() => {
		setIsCorrecting(false);
		setCorrectionKey("");
	}, [paymentId]);

	const handleSubmit = async (data: PaymentFormValues) => {
		if (!paymentId) {
			return;
		}

		try {
			if (isCorrecting) {
				const reason = data.correctionReason?.trim();
				if (!reason || reason.length < 5) {
					toast.error(
						"Please explain why the payment is being corrected",
					);
					return;
				}
				await correctionMutation.mutateAsync({
					id: paymentId,
					idempotencyKey:
						correctionKey ||
						`payment-correction:${crypto.randomUUID()}`,
					amount: data.amount,
					paymentMethod: data.paymentMethod,
					receivedDate: data.receivedDate,
					transactionReference: data.transactionReference || null,
					notes: data.notes || null,
					reason,
				});
			} else {
				await updateMutation.mutateAsync({
					id: paymentId,
					amount: canEditFinancialDetails ? data.amount : undefined,
					paymentMethod: canEditFinancialDetails
						? data.paymentMethod
						: undefined,
					receivedDate: canEditFinancialDetails
						? data.receivedDate
						: undefined,
					transactionReference: data.transactionReference || null,
					notes: data.notes || null,
				});
			}

			await queryClient.invalidateQueries({
				queryKey: orpc.studioPayments.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.bookings.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
			});
			toast.success(
				isCorrecting
					? "Payment corrected and replacement created"
					: "Payment updated successfully",
			);
			close();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to update payment";
			toast.error(message);
		}
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent
				side="right"
				className="sm:max-w-xl p-0 gap-0 flex flex-col"
			>
				<SheetHeader
					className={cn(
						"shrink-0 p-4 transition-shadow duration-200",
						isScrolled &&
							"shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]",
					)}
				>
					<SheetTitle className="text-xl">
						{isCorrecting ? "Correct Payment" : "Edit Payment"}
					</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					{isLoading ? (
						<div className="space-y-4 px-4 py-4">
							<Skeleton className="h-10 w-full" />
							<div className="grid grid-cols-3 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-20 w-full" />
						</div>
					) : (
						<div className="flex h-full min-h-0 flex-col">
							{payment?.data.correction && (
								<div className="mx-4 mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
									This payment replaced ₹
									{payment.data.correction.originalAmount}.
									Reason: {payment.data.correction.reason}
									{payment.data.correction.voidedReceiptNumber
										? ` Previous receipt ${payment.data.correction.voidedReceiptNumber} was voided.`
										: ""}
								</div>
							)}
							{!canEditFinancialDetails && !isCorrecting && (
								<div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-md border p-3">
									<p className="text-sm text-muted-foreground">
										Need to change the amount, method, or
										date? Preserve the audit trail by
										creating a correction.
									</p>
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setCorrectionKey(
												`payment-correction:${crypto.randomUUID()}`,
											);
											setIsCorrecting(true);
										}}
									>
										Correct payment
									</Button>
								</div>
							)}
							<PaymentForm
								defaultValues={payment?.data}
								booking={payment?.data?.booking}
								onSubmit={handleSubmit}
								mode={isCorrecting ? "correct" : "edit"}
								isPending={
									updateMutation.isPending ||
									correctionMutation.isPending
								}
								onScrollChange={setIsScrolled}
							/>
						</div>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
