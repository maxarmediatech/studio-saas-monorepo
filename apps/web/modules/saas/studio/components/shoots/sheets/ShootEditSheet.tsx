"use client";

import { Button } from "@repo/ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useShootParams } from "@saas/studio/hooks/params/use-shoot-params";
import {
	shootsApi,
	shootsMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { ShootForm, type ShootFormValues } from "../ShootForm";

export function ShootEditSheet() {
	const { shootId, close } = useShootParams();
	const isOpen = Boolean(shootId);
	const queryClient = useQueryClient();

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
		if (!shootId) return;

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
			<SheetContent side="right" className="sm:max-w-md overflow-y-auto">
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<SheetTitle className="text-xl">Edit Shoot</SheetTitle>
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
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
