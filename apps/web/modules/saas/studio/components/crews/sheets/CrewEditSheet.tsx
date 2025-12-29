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
import { useCrewParams } from "@saas/studio/hooks/params/use-crew-params";
import { CrewForm, type CrewFormValues } from "../CrewForm";
import { crewsApi, crewsMutations, studioQueryKeys } from "@saas/studio/lib/api";

export function CrewEditSheet() {
	const { crewId, close } = useCrewParams();
	const isOpen = Boolean(crewId);
	const queryClient = useQueryClient();

	const { data: crew, isLoading } = useQuery({
		...crewsApi.getOptions(crewId!),
		enabled: isOpen && !!crewId,
	});

	const updateMutation = useMutation({
		...crewsMutations.update(),
		onSuccess: () => {
			toast.success("Crew member updated successfully");
			queryClient.invalidateQueries({ queryKey: studioQueryKeys.crews.all });
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update crew member");
		},
	});

	const handleSubmit = async (data: CrewFormValues) => {
		if (!crewId) return;

		await updateMutation.mutateAsync({
			id: crewId,
			name: data.name,
			email: data.email || null,
			phoneNumber: data.phoneNumber || null,
			role: data.role,
			status: data.status,
			dailyRate: data.dailyRate || null,
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent side="right" className="sm:max-w-md">
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<SheetTitle className="text-xl">Edit Crew Member</SheetTitle>
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
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<Skeleton className="h-10 w-full" />
						</div>
					) : (
						<CrewForm
							defaultValues={crew?.data}
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
