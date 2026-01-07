"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useBookingParams } from "@saas/studio/hooks/params";
import { useDeliverableParams } from "@saas/studio/hooks/params/use-deliverable-params";
import { deliverablesMutations, studioQueryKeys } from "@saas/studio/lib/api";
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

	const createMutation = useMutation({
		...deliverablesMutations.create(),
		onSuccess: () => {
			toast.success("Deliverable added successfully");
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.deliverables.all,
			});
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to add deliverable");
		},
	});

	const handleSubmit = async (data: DeliverableFormValues) => {
		await createMutation.mutateAsync({
			bookingId: data.bookingId,
			name: data.name,
			deliverableType: data.deliverableType,
			description: data.description || undefined,
			dueDate: data.dueDate || undefined,
			status: data.status || undefined,
			priority: data.priority || undefined,
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
					<SheetTitle className="text-xl">Add Deliverable</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					<DeliverableForm
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
