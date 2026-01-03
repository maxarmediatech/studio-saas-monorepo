"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useShootParams } from "@saas/studio/hooks/params/use-shoot-params";
import { shootsMutations, studioQueryKeys } from "@saas/studio/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShootForm, type ShootFormValues } from "../ShootForm";

export function ShootCreateSheet() {
	const { createShoot, close } = useShootParams();
	const isOpen = Boolean(createShoot);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

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
					<SheetTitle className="text-xl">Add Shoot</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					<ShootForm
						onSubmit={handleSubmit}
						mode="create"
						isPending={createMutation.isPending}
						onScrollChange={setIsScrolled}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
