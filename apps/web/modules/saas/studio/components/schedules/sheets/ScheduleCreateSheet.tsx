"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useBookingParams } from "@saas/studio/hooks/params";
import { useScheduleParams } from "@saas/studio/hooks/params/use-schedule-params";
import { studioPaymentsMutations, studioQueryKeys } from "@saas/studio/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ScheduleForm, type ScheduleFormValues } from "../ScheduleForm";

export function ScheduleCreateSheet() {
	const { createSchedule, close } = useScheduleParams();
	const { bookingId } = useBookingParams();
	const isOpen = Boolean(createSchedule);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const createMutation = useMutation({
		...studioPaymentsMutations.createSchedule(),
		onSuccess: () => {
			toast.success("Payment schedule created successfully");
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.payments.all,
			});
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create payment schedule");
		},
	});

	const handleSubmit = async (data: ScheduleFormValues) => {
		await createMutation.mutateAsync({
			bookingId: data.bookingId,
			name: data.name,
			amount: data.amount,
			dueDate: data.dueDate,
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
					<SheetTitle className="text-xl">Add Payment Schedule</SheetTitle>
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
