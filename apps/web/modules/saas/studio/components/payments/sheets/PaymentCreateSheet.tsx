"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Button } from "@repo/ui/components/button";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePaymentParams } from "@saas/studio/hooks/params/use-payment-params";
import { PaymentForm, type PaymentFormValues } from "../PaymentForm";
import { studioPaymentsMutations, studioQueryKeys } from "@saas/studio/lib/api";

export function PaymentCreateSheet() {
	const { createPayment, close } = usePaymentParams();
	const isOpen = Boolean(createPayment);
	const queryClient = useQueryClient();

	const createMutation = useMutation({
		...studioPaymentsMutations.createReceived(),
		onSuccess: () => {
			toast.success("Payment recorded successfully");
			queryClient.invalidateQueries({ queryKey: studioQueryKeys.payments.all });
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
			<SheetContent side="right" className="sm:max-w-lg">
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<SheetTitle className="text-xl">Record Payment</SheetTitle>
					<Button
						size="icon"
						variant="ghost"
						onClick={close}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</SheetHeader>
				<PaymentForm
					onSubmit={handleSubmit}
					mode="create"
					isPending={createMutation.isPending}
				/>
			</SheetContent>
		</Sheet>
	);
}
