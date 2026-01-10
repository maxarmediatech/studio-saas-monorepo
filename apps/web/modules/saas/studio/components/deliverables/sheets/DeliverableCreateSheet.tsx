"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useBookingParams } from "@saas/studio/hooks/params";
import { useDeliverableParams } from "@saas/studio/hooks/params/use-deliverable-params";
import { deliverablesMutations } from "@saas/studio/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
	DeliverableForm,
	type DeliverableFormValues,
} from "../DeliverableForm";

export function DeliverableCreateSheet() {
	const { createDeliverable, close } = useDeliverableParams();
	const { bookingId } = useBookingParams();
	const isOpen = Boolean(createDeliverable);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const createMutation = useMutation(deliverablesMutations.create());
	const assignCrewMutation = useMutation(deliverablesMutations.assign());

	const handleSubmit = async (data: DeliverableFormValues) => {
		try {
			const result = await createMutation.mutateAsync({
				bookingId: data.bookingId,
				name: data.name,
				description: data.description || undefined,
				quantity: data.quantity,
				cost: data.cost || undefined,
				dueDate: data.dueDate || undefined,
				status: data.status || undefined,
			});

			const crewAssignments = data.crewAssignments ?? [];
			if (crewAssignments.length > 0 && result.data?.id) {
				const deliverableId = result.data.id;
				await Promise.all(
					crewAssignments
						.filter((a) => a.crewId)
						.map((assignment) =>
							assignCrewMutation.mutateAsync({
								deliverableId,
								crewId: assignment.crewId,
							}),
						),
				);
			}

			await queryClient.invalidateQueries({
				queryKey: orpc.deliverables.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.bookings.key(),
			});
			toast.success("Deliverable added successfully");
			close();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to add deliverable";
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
					<SheetTitle className="text-xl">Add Deliverable</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					<DeliverableForm
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
