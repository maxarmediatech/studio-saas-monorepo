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
import { useCrewParams } from "@saas/studio/hooks/params/use-crew-params";
import { CrewForm, type CrewFormValues } from "../CrewForm";
import { crewsMutations, studioQueryKeys } from "@saas/studio/lib/api";

export function CrewCreateSheet() {
	const { createCrew, close } = useCrewParams();
	const isOpen = Boolean(createCrew);
	const queryClient = useQueryClient();

	const createMutation = useMutation({
		...crewsMutations.create(),
		onSuccess: () => {
			toast.success("Crew member added successfully");
			queryClient.invalidateQueries({ queryKey: studioQueryKeys.crews.all });
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to add crew member");
		},
	});

	const handleSubmit = async (data: CrewFormValues) => {
		await createMutation.mutateAsync({
			name: data.name,
			email: data.email || undefined,
			phoneNumber: data.phoneNumber || undefined,
			role: data.role,
			status: data.status,
			dailyRate: data.dailyRate || undefined,
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent side="right" className="sm:max-w-md">
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<SheetTitle className="text-xl">Add Crew Member</SheetTitle>
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
					<CrewForm
						onSubmit={handleSubmit}
						mode="create"
						isPending={createMutation.isPending}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
