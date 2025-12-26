"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Button } from "@repo/ui/components/button";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDeliverableParams } from "@saas/studio/hooks/params/use-deliverable-params";
import { DeliverableForm, type DeliverableFormValues } from "../DeliverableForm";
import { deliverablesMutations, studioQueryKeys } from "@saas/studio/lib/api";

export function DeliverableCreateSheet() {
	const { createDeliverable, close } = useDeliverableParams();
	const isOpen = Boolean(createDeliverable);
	const queryClient = useQueryClient();

	const createMutation = useMutation({
		...deliverablesMutations.create(),
		onSuccess: () => {
			toast.success("Deliverable added successfully");
			queryClient.invalidateQueries({ queryKey: studioQueryKeys.deliverables.all });
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
			<SheetContent side="right" className="sm:max-w-lg">
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<SheetTitle className="text-xl">Add Deliverable</SheetTitle>
					<Button
						size="icon"
						variant="ghost"
						onClick={close}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</SheetHeader>
				<DeliverableForm
					onSubmit={handleSubmit}
					mode="create"
					isPending={createMutation.isPending}
				/>
			</SheetContent>
		</Sheet>
	);
}
