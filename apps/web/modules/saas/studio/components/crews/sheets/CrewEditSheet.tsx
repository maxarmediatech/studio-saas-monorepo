"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useCrewParams } from "@saas/studio/hooks/params/use-crew-params";
import { crewsApi, crewsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CrewForm, type CrewFormValues } from "../CrewForm";

export function CrewEditSheet() {
	const { crewId, close } = useCrewParams();
	const isOpen = Boolean(crewId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const { data: crew, isLoading } = useQuery({
		...crewsApi.getOptions(crewId ?? ""),
		enabled: isOpen && !!crewId,
	});

	const updateMutation = useMutation({
		...crewsMutations.update(),
		onSuccess: () => {
			toast.success("Crew member updated successfully");
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
			toast.error(error.message || "Failed to update crew member");
		},
	});

	const handleSubmit = async (data: CrewFormValues) => {
		if (!crewId) {
			return;
		}

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
					<SheetTitle className="text-xl">
						Edit Crew Member
					</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					{isLoading ? (
						<div className="space-y-4 px-4 py-4">
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
							onScrollChange={setIsScrolled}
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
