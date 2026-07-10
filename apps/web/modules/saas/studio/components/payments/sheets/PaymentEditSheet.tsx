"use client";

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
import { useState } from "react";
import { toast } from "sonner";
import { PaymentForm, type PaymentFormValues } from "../PaymentForm";

export function PaymentEditSheet() {
	const { paymentId, close } = usePaymentParams();
	const isOpen = Boolean(paymentId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const { data: payment, isLoading } = useQuery({
		...studioPaymentsApi.getReceivedOptions(paymentId ?? ""),
		enabled: isOpen && !!paymentId,
	});

	const updateMutation = useMutation(
		studioPaymentsMutations.updateReceived(),
	);
	const canEditFinancialDetails =
		payment?.data.financialProtection.canEditFinancialDetails ?? false;

	const handleSubmit = async (data: PaymentFormValues) => {
		if (!paymentId) {
			return;
		}

		try {
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

			await queryClient.invalidateQueries({
				queryKey: orpc.studioPayments.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.bookings.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
			});
			toast.success("Payment updated successfully");
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
					<SheetTitle className="text-xl">Edit Payment</SheetTitle>
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
						<PaymentForm
							defaultValues={payment?.data}
							booking={payment?.data?.booking}
							onSubmit={handleSubmit}
							mode="edit"
							isPending={updateMutation.isPending}
							onScrollChange={setIsScrolled}
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
