"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeliverableParams } from "@saas/studio/hooks/params/use-deliverable-params";
import { DeliverableForm, type DeliverableFormValues } from "../DeliverableForm";
import {
	deliverablesApi,
	deliverablesMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";

export function DeliverableEditSheet() {
	const { deliverableId, close } = useDeliverableParams();
	const isOpen = Boolean(deliverableId);
	const queryClient = useQueryClient();

	const { data: deliverable, isLoading } = useQuery({
		...deliverablesApi.getOptions(deliverableId!),
		enabled: isOpen && !!deliverableId,
	});

	const updateMutation = useMutation({
		...deliverablesMutations.update(),
		onSuccess: () => {
			toast.success("Deliverable updated successfully");
			queryClient.invalidateQueries({ queryKey: studioQueryKeys.deliverables.all });
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update deliverable");
		},
	});

	const handleSubmit = async (data: DeliverableFormValues) => {
		if (!deliverableId) return;

		await updateMutation.mutateAsync({
			id: deliverableId,
			name: data.name,
			deliverableType: data.deliverableType,
			description: data.description || null,
			dueDate: data.dueDate || null,
			status: data.status || undefined,
			priority: data.priority || undefined,
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent side="right" className="sm:max-w-md">
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<SheetTitle className="text-xl">Edit Deliverable</SheetTitle>
					<Button
						size="icon"
						variant="ghost"
						onClick={close}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</SheetHeader>
				<div className="px-4">
					{isLoading ? (
						<div className="space-y-4">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-24 w-full" />
							<Skeleton className="h-10 w-full" />
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
						</div>
					) : (
						<DeliverableForm
							defaultValues={deliverable?.data}
							onSubmit={handleSubmit}
							mode="edit"
							isPending={updateMutation.isPending}
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
