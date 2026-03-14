"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useCrewParams } from "@saas/studio/hooks/params/use-crew-params";
import { crewsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CrewForm, type CrewFormValues } from "../CrewForm";

export function CrewCreateSheet() {
	const { createCrew, close } = useCrewParams();
	const isOpen = Boolean(createCrew);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const createMutation = useMutation({
		...crewsMutations.create(),
		onSuccess: () => {
			toast.success("Freelancer added successfully");
			// Use ORPC's key generator to match the booking form's query keys
			queryClient.invalidateQueries({
				queryKey: orpc.crews.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
			});
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to add freelancer");
		},
	});

	const handleSubmit = async (data: CrewFormValues) => {
		await createMutation.mutateAsync({
			name: data.name,
			email: data.email || undefined,
			phoneNumber: data.phoneNumber || undefined,
			specializations: data.specializations,
			status: data.status,
			dailyRate: data.dailyRate || undefined,
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
					<SheetTitle className="text-xl">Add Freelancer</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					<CrewForm
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
