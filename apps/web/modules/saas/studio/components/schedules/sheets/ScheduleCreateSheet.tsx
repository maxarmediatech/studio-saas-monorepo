"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useScheduleParams } from "@saas/studio/hooks/params/use-schedule-params";
import { useContextBookingId } from "@saas/studio/hooks/use-context-booking-id";
import { studioPaymentsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ScheduleForm, type ScheduleFormValues } from "../ScheduleForm";

export function ScheduleCreateSheet() {
	const { createSchedule, close } = useScheduleParams();
	const bookingId = useContextBookingId();
	const isOpen = Boolean(createSchedule);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const createMutation = useMutation(
		studioPaymentsMutations.createSchedule(),
	);

	const handleSubmit = async (data: ScheduleFormValues) => {
		try {
			await createMutation.mutateAsync({
				bookingId: data.bookingId,
				name: data.name,
				amount: data.amount,
				dueDate: data.dueDate,
				taxType: data.taxType,
				notes: data.notes || undefined,
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
			toast.success("Payment schedule created successfully");
			close();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to create payment schedule";
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
						Add Payment Schedule
					</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					<ScheduleForm
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
