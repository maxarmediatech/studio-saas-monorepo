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

		await updateMutation.mutateAsync({
			id: clientId,
			name: data.name,
			email: data.email || null,
			phoneNumber: data.phoneNumber || null,
			alternatePhone: data.alternatePhone || null,
			address: data.address || null,
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent side="right" className="sm:max-w-lg">
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<SheetTitle className="text-xl">Edit Client</SheetTitle>
					<Button
						size="icon"
						variant="ghost"
						onClick={close}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</SheetHeader>
				{isLoading ? (
					<div className="space-y-4">
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
					/>
				)}
			</SheetContent>
		</Sheet>
	);
}
