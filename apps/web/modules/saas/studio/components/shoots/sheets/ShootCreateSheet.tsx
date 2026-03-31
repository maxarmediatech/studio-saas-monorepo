"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useShootParams } from "@saas/studio/hooks/params/use-shoot-params";
import { useContextBookingId } from "@saas/studio/hooks/use-context-booking-id";
import { shootsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShootForm, type ShootFormValues } from "../ShootForm";

export function ShootCreateSheet() {
	const { createShoot, close } = useShootParams();
	const bookingId = useContextBookingId();
	const isOpen = Boolean(createShoot);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const createMutation = useMutation(shootsMutations.create());
	const assignCrewMutation = useMutation(shootsMutations.assignCrew());

	const handleSubmit = async (data: ShootFormValues) => {
		try {
			const result = await createMutation.mutateAsync({
				bookingId: data.bookingId,
				name: data.shootType,
				shootType: data.shootType,
				shootDate: data.shootDate,
				startTime: data.startTime || undefined,
				endTime: undefined,
				venue: undefined,
				venueAddress: data.location || undefined,
				notes: data.notes || undefined,
				requiredCrewCount: data.requiredCrewCount?.trim()
					? Number.parseInt(data.requiredCrewCount, 10)
					: undefined,
				additionalServices: data.additionalServices ?? [],
			});

			const crewAssignments = data.crewAssignments ?? [];
			if (crewAssignments.length > 0 && result.data?.id) {
				const shootId = result.data.id;
				await Promise.all(
					crewAssignments
						.filter((a) => a.crewId)
						.map((assignment) =>
							assignCrewMutation.mutateAsync({
								shootId,
								crewId: assignment.crewId,
								rate: assignment.rate || undefined,
							}),
						),
				);
			}

			await queryClient.invalidateQueries({
				queryKey: orpc.shoots.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.bookings.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
			});
			toast.success("Shoot added successfully");
			close();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to add shoot";
			toast.error(message);
		}
	};

	const isPending = createMutation.isPending || assignCrewMutation.isPending;

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
					<SheetTitle className="text-xl">Add Shoot</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					<ShootForm
						onSubmit={handleSubmit}
						mode="create"
						isPending={isPending}
						onScrollChange={setIsScrolled}
						defaultBookingId={bookingId ?? undefined}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
