"use client";

import type {
	DeliverableListItem,
	ListDeliverablesOutput,
} from "@repo/api/modules/studio/schemas/deliverable";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useAllCrewOptions } from "@saas/studio/components/shared";
import { useDeliverableParams } from "@saas/studio/hooks/params/use-deliverable-params";
import { deliverablesApi, deliverablesMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	DeliverableForm,
	type DeliverableFormValues,
} from "../DeliverableForm";

function patchDeliverableCrew(
	previous: ListDeliverablesOutput | undefined,
	deliverableId: string,
	assignedCrew: DeliverableListItem["assignedCrew"],
) {
	if (!previous) {
		return previous;
	}

	return {
		...previous,
		data: previous.data.map((item) =>
			item.id === deliverableId
				? {
						...item,
						assignmentsCount: assignedCrew.length,
						assignedCrew,
					}
				: item,
		),
	};
}

export function DeliverableEditSheet() {
	const { deliverableId, close } = useDeliverableParams();
	const isOpen = Boolean(deliverableId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);
	const { data: crews = [] } = useAllCrewOptions(isOpen);

	const { data: deliverable, isLoading } = useQuery({
		...deliverablesApi.getOptions(deliverableId ?? ""),
		enabled: isOpen && !!deliverableId,
	});

	const updateMutation = useMutation(deliverablesMutations.update());
	const assignCrewMutation = useMutation(deliverablesMutations.assign());
	const unassignCrewMutation = useMutation(deliverablesMutations.unassign());

	const existingAssignments = useMemo(() => {
		return deliverable?.data?.assignments ?? [];
	}, [deliverable?.data?.assignments]);

	const crewNameById = useMemo(() => {
		return new Map(crews.map((crew) => [crew.id, crew.name]));
	}, [crews]);

	const handleSubmit = async (data: DeliverableFormValues) => {
		if (!deliverableId) {
			return;
		}

		try {
			await updateMutation.mutateAsync({
				id: deliverableId,
				name: data.name,
				description: data.description || null,
				quantity: data.quantity,
				cost: data.cost || null,
				dueDate: data.dueDate || null,
				status: data.status || undefined,
			});

			const newAssignments =
				data.crewAssignments?.filter((a) => a.crewId) ?? [];

			const existingCrewIds = new Set(
				existingAssignments.map((a) => a.crewId),
			);
			const newCrewIds = new Set(newAssignments.map((a) => a.crewId));

			const toAdd = newAssignments.filter(
				(a) => !existingCrewIds.has(a.crewId),
			);
			const toRemove = existingAssignments.filter(
				(a) => !newCrewIds.has(a.crewId),
			);

			await Promise.all([
				...toAdd.map((assignment) =>
					assignCrewMutation.mutateAsync({
						deliverableId,
						crewId: assignment.crewId,
					}),
				),
				...toRemove.map((assignment) =>
					unassignCrewMutation.mutateAsync({
						deliverableId,
						crewId: assignment.crewId,
					}),
				),
			]);

			const assignedCrew = newAssignments.map((assignment) => {
				const existingAssignment = existingAssignments.find(
					(item) => item.crewId === assignment.crewId,
				);

				return {
					id: assignment.crewId,
					name:
						existingAssignment?.crew.name ??
						crewNameById.get(assignment.crewId) ??
						"Assigned crew",
					avatarUrl: null,
				};
			});
			const bookingId = deliverable?.data?.bookingId ?? data.bookingId;
			const bookingDeliverablesQueries = [
				deliverablesApi.listOptions({ bookingId, limit: 100 }).queryKey,
				deliverablesApi.listOptions({ bookingId, limit: 50 }).queryKey,
			];

			for (const queryKey of bookingDeliverablesQueries) {
				queryClient.setQueryData<ListDeliverablesOutput | undefined>(
					queryKey,
					(previous) =>
						patchDeliverableCrew(
							previous,
							deliverableId,
							assignedCrew,
						),
				);
			}

			await Promise.all([
				queryClient.invalidateQueries({
					queryKey:
						deliverablesApi.getOptions(deliverableId).queryKey,
				}),
				...bookingDeliverablesQueries.map((queryKey) =>
					queryClient.invalidateQueries({ queryKey }),
				),
				queryClient.invalidateQueries({
					queryKey: orpc.deliverables.key(),
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.bookings.key(),
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.activities.key(),
				}),
			]);
			toast.success("Deliverable updated successfully");
			close();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to update deliverable";
			toast.error(message);
		}
	};

	const isPending =
		updateMutation.isPending ||
		assignCrewMutation.isPending ||
		unassignCrewMutation.isPending;

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
						Edit Deliverable
					</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					{isLoading ? (
						<div className="space-y-4 px-4 py-4">
							<Skeleton className="h-10 w-full" />
							<div className="grid grid-cols-4 gap-4">
								<div className="col-span-2">
									<Skeleton className="h-10 w-full" />
								</div>
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<Skeleton className="h-20 w-full" />
							<Skeleton className="h-10 w-full" />
						</div>
					) : (
						<DeliverableForm
							defaultValues={deliverable?.data}
							booking={deliverable?.data?.booking}
							existingAssignments={existingAssignments}
							onSubmit={handleSubmit}
							mode="edit"
							isPending={isPending}
							onScrollChange={setIsScrolled}
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
