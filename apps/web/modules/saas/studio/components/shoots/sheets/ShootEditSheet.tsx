"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useShootParams } from "@saas/studio/hooks/params/use-shoot-params";
import {
	shootsApi,
	shootsMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShootForm, type ShootFormValues } from "../ShootForm";

export function ShootEditSheet() {
	const { shootId, close } = useShootParams();
	const isOpen = Boolean(shootId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const { data: shoot, isLoading } = useQuery({
		...shootsApi.getOptions(shootId!),
		enabled: isOpen && !!shootId,
	});

	const updateMutation = useMutation({
		...shootsMutations.update(),
		onSuccess: () => {
			toast.success("Shoot updated successfully");
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.shoots.all,
			});
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update shoot");
		},
	});

	const handleSubmit = async (data: ShootFormValues) => {
		if (!shootId) {
			return;
		}

		await updateMutation.mutateAsync({
			id: shootId,
			name: data.name,
			shootType: data.shootType,
			shootDate: data.shootDate,
			startTime: data.startTime || null,
			endTime: data.endTime || null,
			venue: data.venue || null,
			venueAddress: data.venueAddress || null,
			notes: data.notes || null,
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
							defaultValues={shoot?.data}
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
