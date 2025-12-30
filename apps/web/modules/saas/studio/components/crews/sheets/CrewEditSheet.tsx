"use client";

import { useState, useCallback } from "react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCrewParams } from "@saas/studio/hooks/params/use-crew-params";
import { CrewForm, type CrewFormValues } from "../CrewForm";
import { crewsApi, crewsMutations, studioQueryKeys } from "@saas/studio/lib/api";

export function CrewEditSheet() {
	const { crewId, close } = useCrewParams();
	const isOpen = Boolean(crewId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
		const target = event.target as HTMLDivElement;
		setIsScrolled(target.scrollTop > 0);
	}, []);

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
			<SheetContent side="right" className="sm:max-w-md p-0 gap-0 flex flex-col">
				<SheetHeader
					className={cn(
						"shrink-0 p-4 transition-shadow duration-200",
						isScrolled && "shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]"
					)}
				>
					<SheetTitle className="text-xl">Edit Crew Member</SheetTitle>
				</SheetHeader>
				<ScrollArea className="flex-1 min-h-0" onScrollCapture={handleScroll}>
					<div className="px-4 py-4">
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
				</ScrollArea>
			</SheetContent>
		</Sheet>
	);
}
