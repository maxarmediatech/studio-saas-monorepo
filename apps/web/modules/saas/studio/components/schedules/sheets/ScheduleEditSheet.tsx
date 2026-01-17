"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useScheduleParams } from "@saas/studio/hooks/params/use-schedule-params";
import {
	studioPaymentsApi,
	studioPaymentsMutations,
} from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ScheduleForm, type ScheduleFormValues } from "../ScheduleForm";

export function ScheduleEditSheet() {
	const { scheduleId, close } = useScheduleParams();
	const isOpen = Boolean(scheduleId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const { data: schedule, isLoading } = useQuery({
		...studioPaymentsApi.getScheduleOptions(scheduleId ?? ""),
		enabled: isOpen && !!scheduleId,
	});

	const updateMutation = useMutation(
		studioPaymentsMutations.updateSchedule(),
	);

	const handleSubmit = async (data: ScheduleFormValues) => {
		if (!scheduleId) {
			return;
		}

		try {
			await updateMutation.mutateAsync({
				id: scheduleId,
				name: data.name,
				amount: data.amount,
				dueDate: data.dueDate,
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
			toast.success("Payment schedule updated successfully");
			close();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to update payment schedule";
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
						Edit Payment Schedule
					</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					{isLoading ? (
						<div className="space-y-4 px-4 py-4">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<Skeleton className="h-10 w-full" />
						</div>
					) : (
						<ScheduleForm
							defaultValues={schedule?.data}
							booking={schedule?.data?.booking}
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
