"use client";

import { useState } from "react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useClientParams } from "@saas/studio/hooks/params/use-client-params";
import { ClientForm, type ClientFormValues } from "../ClientForm";
import {
	clientsApi,
	clientsMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";

export function ClientEditSheet() {
	const { clientId, close } = useClientParams();
	const isOpen = Boolean(clientId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const { data: client, isLoading } = useQuery({
		...clientsApi.getOptions(clientId!),
		enabled: isOpen && !!clientId,
	});

	const updateMutation = useMutation({
		...clientsMutations.update(),
		onSuccess: () => {
			toast.success("Client updated successfully");
			queryClient.invalidateQueries({ queryKey: studioQueryKeys.clients.all });
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update client");
		},
	});

	const handleSubmit = async (data: ClientFormValues) => {
		if (!clientId) return;

		// Build metadata object from form fields
		const metadata: Record<string, string> = {};
		if (data.profession) metadata.profession = data.profession;
		if (data.source) metadata.source = data.source;
		if (data.socialHandle) metadata.socialHandle = data.socialHandle;
		if (data.notes) metadata.notes = data.notes;

		await updateMutation.mutateAsync({
			id: clientId,
			name: data.name,
			email: data.email || null,
			phoneNumber: data.phoneNumber || null,
			alternatePhone: data.alternatePhone || null,
			address: data.address || null,
			metadata: Object.keys(metadata).length > 0 ? metadata : null,
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
					<SheetTitle className="text-xl">Edit Client</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					{isLoading ? (
						<div className="space-y-4 p-4">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<Skeleton className="h-24 w-full" />
						</div>
					) : (
						<ClientForm
							defaultValues={client?.data}
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
