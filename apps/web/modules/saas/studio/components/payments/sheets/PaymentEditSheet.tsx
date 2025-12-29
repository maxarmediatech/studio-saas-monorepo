"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePaymentParams } from "@saas/studio/hooks/params/use-payment-params";
import { PaymentForm, type PaymentFormValues } from "../PaymentForm";
import {
	studioPaymentsApi,
	studioPaymentsMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";

export function PaymentEditSheet() {
	const { paymentId, close } = usePaymentParams();
	const isOpen = Boolean(paymentId);
	const queryClient = useQueryClient();

	const { data: payment, isLoading } = useQuery({
		...studioPaymentsApi.getReceivedOptions(paymentId!),
		enabled: isOpen && !!paymentId,
	});

	const updateMutation = useMutation({
		...studioPaymentsMutations.updateReceived(),
		onSuccess: () => {
			toast.success("Payment updated successfully");
			queryClient.invalidateQueries({ queryKey: studioQueryKeys.payments.all });
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update payment");
		},
	});

	const handleSubmit = async (data: PaymentFormValues) => {
		if (!paymentId) return;

		await updateMutation.mutateAsync({
			id: paymentId,
			amount: data.amount,
			paymentMethod: data.paymentMethod,
			receivedDate: data.receivedDate,
			transactionReference: data.transactionReference || null,
			notes: data.notes || null,
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent side="right" className="sm:max-w-md">
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<SheetTitle className="text-xl">Edit Payment</SheetTitle>
					<Button
						size="icon"
						variant="ghost"
						onClick={close}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</SheetHeader>
				<div className="px-4">
					{isLoading ? (
						<div className="space-y-4">
							<Skeleton className="h-10 w-full" />
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<Skeleton className="h-24 w-full" />
						</div>
					) : (
						<PaymentForm
							defaultValues={payment?.data}
							onSubmit={handleSubmit}
							mode="edit"
							isPending={updateMutation.isPending}
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
