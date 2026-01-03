"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { usePaymentParams } from "@saas/studio/hooks/params/use-payment-params";
import { studioPaymentsMutations, studioQueryKeys } from "@saas/studio/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PaymentForm, type PaymentFormValues } from "../PaymentForm";

export function PaymentCreateSheet() {
	const { createPayment, close } = usePaymentParams();
	const isOpen = Boolean(createPayment);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const createMutation = useMutation({
		...studioPaymentsMutations.createReceived(),
		onSuccess: () => {
			toast.success("Payment recorded successfully");
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.payments.all,
			});
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to record payment");
		},
	});

	const handleSubmit = async (data: PaymentFormValues) => {
		await createMutation.mutateAsync({
			bookingId: data.bookingId,
			amount: data.amount,
			paymentMethod: data.paymentMethod,
			receivedDate: data.receivedDate,
			transactionReference: data.transactionReference || undefined,
			notes: data.notes || undefined,
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent
				side="right"
				className="sm:max-w-md p-0 gap-0 flex flex-col"
			>
				<SheetHeader
					className={cn(
						"shrink-0 p-4 transition-shadow duration-200",
						isScrolled &&
							"shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]",
					)}
				>
					<SheetTitle className="text-xl">Record Payment</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					<PaymentForm
						onSubmit={handleSubmit}
						mode="create"
						isPending={createMutation.isPending}
						onScrollChange={setIsScrolled}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
