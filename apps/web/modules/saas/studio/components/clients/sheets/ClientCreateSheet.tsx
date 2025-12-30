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
import { useClientParams } from "@saas/studio/hooks/params/use-client-params";
import { useClientCallback } from "@saas/studio/hooks/params/client-callback-context";
import { ClientForm, type ClientFormValues } from "../ClientForm";
import { clientsMutations, studioQueryKeys } from "@saas/studio/lib/api";

export function ClientCreateSheet() {
	const { createClient, close } = useClientParams();
	const { executeCallback, clearCallback } = useClientCallback();
	const isOpen = Boolean(createClient);
	const queryClient = useQueryClient();

	const createMutation = useMutation({
		...clientsMutations.create(),
		onSuccess: (data) => {
			toast.success("Client added successfully");
			queryClient.invalidateQueries({ queryKey: studioQueryKeys.clients.all });
			// Execute callback if one was registered (e.g., from booking form)
			executeCallback(data.data.id);
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to add client");
		},
	});

	// Clear callback when sheet is closed without creating
	const handleClose = () => {
		clearCallback();
		close();
	};

	const handleSubmit = async (data: ClientFormValues) => {
		// Build metadata object from form fields
		const metadata: Record<string, string> = {};
		if (data.location) metadata.location = data.location;
		if (data.source) metadata.source = data.source;
		if (data.socialHandle) metadata.socialHandle = data.socialHandle;
		if (data.notes) metadata.notes = data.notes;

		await createMutation.mutateAsync({
			name: data.name,
			email: data.email || undefined,
			phoneNumber: data.phoneNumber || undefined,
			alternatePhone: data.alternatePhone || undefined,
			address: data.address || undefined,
			metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
			<SheetContent side="right" className="sm:max-w-md">
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<SheetTitle className="text-xl">Add Client</SheetTitle>
					<Button
						size="icon"
						variant="ghost"
						onClick={handleClose}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</SheetHeader>
				<div className="px-4">
					<ClientForm
						onSubmit={handleSubmit}
						mode="create"
						isPending={createMutation.isPending}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
