"use client";

import { useState, useCallback } from "react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
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
	const [isScrolled, setIsScrolled] = useState(false);

	const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
		const target = event.target as HTMLDivElement;
		setIsScrolled(target.scrollTop > 0);
	}, []);

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
			<SheetContent side="right" className="sm:max-w-md p-0 gap-0 flex flex-col">
				<SheetHeader
					className={cn(
						"shrink-0 p-4 transition-shadow duration-200",
						isScrolled && "shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]"
					)}
				>
					<SheetTitle className="text-xl">Edit Deliverable</SheetTitle>
				</SheetHeader>
				<ScrollArea className="flex-1 min-h-0" onScrollCapture={handleScroll}>
					<div className="px-4 py-4">
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
				</ScrollArea>
			</SheetContent>
		</Sheet>
	);
}
