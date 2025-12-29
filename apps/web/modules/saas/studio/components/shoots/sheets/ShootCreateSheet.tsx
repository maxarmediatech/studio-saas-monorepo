"use client";

import { Button } from "@repo/ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { useShootParams } from "@saas/studio/hooks/params/use-shoot-params";
import { shootsMutations, studioQueryKeys } from "@saas/studio/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { ShootForm, type ShootFormValues } from "../ShootForm";

export function ShootCreateSheet() {
	const { createShoot, close } = useShootParams();
	const isOpen = Boolean(createShoot);
	const queryClient = useQueryClient();

	const createMutation = useMutation({
		...shootsMutations.create(),
		onSuccess: () => {
			toast.success("Shoot added successfully");
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.shoots.all,
			});
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to add shoot");
		},
	});

	const handleSubmit = async (data: ShootFormValues) => {
		await createMutation.mutateAsync({
			bookingId: data.bookingId,
			name: data.name,
			shootType: data.shootType,
			shootDate: data.shootDate,
			startTime: data.startTime || undefined,
			endTime: data.endTime || undefined,
			venue: data.venue || undefined,
			venueAddress: data.venueAddress || undefined,
			notes: data.notes || undefined,
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent side="right" className="sm:max-w-md overflow-y-auto">
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<SheetTitle className="text-xl">Add Shoot</SheetTitle>
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
					<ShootForm
						onSubmit={handleSubmit}
						mode="create"
						isPending={createMutation.isPending}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
