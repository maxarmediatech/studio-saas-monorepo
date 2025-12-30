"use client";

import { useState, useCallback } from "react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { cn } from "@repo/ui/lib/utils";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePaymentParams } from "@saas/studio/hooks/params/use-payment-params";
import { PaymentForm, type PaymentFormValues } from "../PaymentForm";
import { studioPaymentsMutations, studioQueryKeys } from "@saas/studio/lib/api";

export function PaymentCreateSheet() {
	const { createPayment, close } = usePaymentParams();
	const isOpen = Boolean(createPayment);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
		const target = event.target as HTMLDivElement;
		setIsScrolled(target.scrollTop > 0);
	}, []);

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
			<SheetContent side="right" className="sm:max-w-md p-0 gap-0 flex flex-col">
				<SheetHeader
					className={cn(
						"shrink-0 p-4 transition-shadow duration-200",
						isScrolled && "shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]"
					)}
				>
					<SheetTitle className="text-xl">Record Payment</SheetTitle>
				</SheetHeader>
				<ScrollArea className="flex-1 min-h-0" onScrollCapture={handleScroll}>
					<div className="px-4 py-4">
						<PaymentForm
							onSubmit={handleSubmit}
							mode="create"
							isPending={createMutation.isPending}
						/>
					</div>
				</ScrollArea>
			</SheetContent>
		</Sheet>
	);
}
