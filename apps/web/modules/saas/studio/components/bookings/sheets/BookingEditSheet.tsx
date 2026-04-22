"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useBookingEditParams } from "@saas/studio/hooks/params/use-booking-edit-params";
import { bookingsApi, bookingsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
	BookingEditForm,
	type BookingEditFormValues,
} from "../BookingEditForm";

export function BookingEditSheet() {
	const { bookingId, close } = useBookingEditParams();
	const isOpen = Boolean(bookingId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const { data: booking, isLoading } = useQuery({
		...bookingsApi.getOptions(bookingId ?? ""),
		enabled: isOpen && !!bookingId,
	});

	const updateMutation = useMutation({
		...bookingsMutations.update(),
		onSuccess: () => {
			toast.success("Booking updated successfully");
			queryClient.invalidateQueries({
				queryKey: orpc.bookings.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
			});
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update booking");
		},
	});

	const handleSubmit = async (data: BookingEditFormValues) => {
		if (!bookingId) {
			return;
		}

		await updateMutation.mutateAsync({
			id: bookingId,
			name: data.name,
			bookingDate: data.bookingDate,
			packageCost: data.packageCost,
			note: data.note || null,
			contractAttachment: data.contractAttachment,
		});
	};

	const bookingData = booking?.data;

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
					<SheetTitle className="text-xl">Edit Booking</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					{isLoading ? (
						<div className="space-y-4 px-4 py-4">
							<div className="flex gap-2">
								<Skeleton className="h-6 w-24" />
								<Skeleton className="h-6 w-20" />
							</div>
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-24 w-full" />
						</div>
					) : (
						<BookingEditForm
							defaultValues={bookingData}
							onSubmit={handleSubmit}
							isPending={updateMutation.isPending}
							onScrollChange={setIsScrolled}
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
