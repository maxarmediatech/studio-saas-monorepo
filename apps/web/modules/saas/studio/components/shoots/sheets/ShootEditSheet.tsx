"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useShootParams } from "@saas/studio/hooks/params/use-shoot-params";
import { shootsApi, shootsMutations } from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ShootForm, type ShootFormValues } from "../ShootForm";

export function ShootEditSheet() {
	const { shootId, close } = useShootParams();
	const isOpen = Boolean(shootId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const { data: shoot, isLoading } = useQuery({
		...shootsApi.getOptions(shootId ?? ""),
		enabled: isOpen && !!shootId,
	});

	const updateMutation = useMutation(shootsMutations.update());
	const assignCrewMutation = useMutation(shootsMutations.assignCrew());
	const unassignCrewMutation = useMutation(shootsMutations.unassignCrew());

	const formDefaultValues = useMemo(():
		| Partial<ShootFormValues>
		| undefined => {
		if (!shoot?.data) return undefined;

		return {
			bookingId: shoot.data.bookingId,
			shootType: shoot.data.shootType,
			shootDate: shoot.data.shootDate,
			startTime: shoot.data.startTime ?? "",
			location: shoot.data.venueAddress ?? "",
			notes: shoot.data.notes ?? "",
			crewAssignments:
				shoot.data.assignments?.map((a) => ({
					crewId: a.crewId,
					rate: a.rate ?? "",
				})) ?? [],
		};
	}, [shoot?.data]);

	const existingAssignments = useMemo(() => {
		return shoot?.data?.assignments ?? [];
	}, [shoot?.data?.assignments]);

	const handleSubmit = async (data: ShootFormValues) => {
		if (!shootId) return;

		try {
			await updateMutation.mutateAsync({
				id: shootId,
				name: data.shootType,
				shootType: data.shootType,
				shootDate: data.shootDate,
				startTime: data.startTime || null,
				endTime: null,
				venue: null,
				venueAddress: data.location || null,
				notes: data.notes || null,
			});

			const newAssignments =
				data.crewAssignments?.filter((a) => a.crewId) ?? [];

			const existingRateByCrewId = new Map(
				existingAssignments.map((a) => [a.crewId, a.rate ?? ""]),
			);
			const newCrewIds = new Set(newAssignments.map((a) => a.crewId));

			const toAdd = newAssignments.filter(
				(a) => !existingRateByCrewId.has(a.crewId),
			);
			const toRemove = existingAssignments.filter(
				(a) => !newCrewIds.has(a.crewId),
			);
			const toUpdateRate = newAssignments.filter((a) => {
				const existingRate = existingRateByCrewId.get(a.crewId);
				return (
					existingRate !== undefined &&
					existingRate !== (a.rate ?? "")
				);
			});

			await Promise.all([
				...toAdd.map((assignment) =>
					assignCrewMutation.mutateAsync({
						shootId,
						crewId: assignment.crewId,
						rate: assignment.rate || undefined,
					}),
				),
				...toRemove.map((assignment) =>
					unassignCrewMutation.mutateAsync({
						shootId,
						crewId: assignment.crewId,
					}),
				),
				...toUpdateRate.map(async (assignment) => {
					await unassignCrewMutation.mutateAsync({
						shootId,
						crewId: assignment.crewId,
					});
					await assignCrewMutation.mutateAsync({
						shootId,
						crewId: assignment.crewId,
						rate: assignment.rate || undefined,
					});
				}),
			]);

			await queryClient.invalidateQueries({
				queryKey: orpc.shoots.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.bookings.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
			});
			toast.success("Shoot updated successfully");
			close();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to update shoot";
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
					<SheetTitle className="text-xl">Edit Shoot</SheetTitle>
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
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-20 w-full" />
							<Skeleton className="h-24 w-full" />
						</div>
					) : (
						<ShootForm
							defaultValues={formDefaultValues}
							booking={shoot?.data?.booking}
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
