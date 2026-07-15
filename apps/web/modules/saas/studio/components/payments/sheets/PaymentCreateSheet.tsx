"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { usePaymentParams } from "@saas/studio/hooks/params/use-payment-params";
import { useContextBookingId } from "@saas/studio/hooks/use-context-booking-id";
import { usePaymentSubmissionKey } from "@saas/studio/hooks/use-payment-submission-key";
import { studioPaymentsMutations } from "@saas/studio/lib/api";
import { buildCreatePaymentRequest } from "@saas/studio/lib/payment-create-request";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PaymentForm, type PaymentFormValues } from "../PaymentForm";

export function PaymentCreateSheet() {
	const { createPayment, close } = usePaymentParams();
	const bookingId = useContextBookingId();
	const { activeOrganization } = useActiveOrganization();
	const isOpen = Boolean(createPayment);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);
	const submissionKey = usePaymentSubmissionKey(
		`${activeOrganization?.id ?? "unknown-org"}:create-payment`,
	);

	const createMutation = useMutation(
		studioPaymentsMutations.createReceived(),
	);
	const handleClose = () => {
		submissionKey.abandon();
		close();
	};

	const handleSubmit = async (data: PaymentFormValues) => {
		try {
			const request = buildCreatePaymentRequest(data);
			await createMutation.mutateAsync({
				...request,
				idempotencyKey: submissionKey.keyFor(request),
			});
			submissionKey.acknowledgeSuccess();

			await Promise.allSettled([
				queryClient.invalidateQueries({
					queryKey: orpc.studioPayments.key(),
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.bookings.key(),
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.activities.key(),
				}),
			]);
			toast.success("Payment recorded successfully");
			close();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to record payment";
			toast.error(message);
		}
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
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
					<SheetTitle className="text-xl">Record Payment</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					<PaymentForm
						onSubmit={handleSubmit}
						mode="create"
						isPending={createMutation.isPending}
						onScrollChange={setIsScrolled}
						defaultBookingId={bookingId ?? undefined}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
