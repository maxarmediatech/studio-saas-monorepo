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
import { ClientForm, type ClientFormValues } from "../ClientForm";
import { clientsMutations, studioQueryKeys } from "@saas/studio/lib/api";

export function ClientCreateSheet() {
	const { createClient, close } = useClientParams();
	const isOpen = Boolean(createClient);
	const queryClient = useQueryClient();

	const createMutation = useMutation({
		...clientsMutations.create(),
		onSuccess: () => {
			toast.success("Client added successfully");
			queryClient.invalidateQueries({ queryKey: studioQueryKeys.clients.all });
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to add client");
		},
	});

	const handleSubmit = async (data: ClientFormValues) => {
		await createMutation.mutateAsync({
			name: data.name,
			email: data.email || undefined,
			phoneNumber: data.phoneNumber || undefined,
			alternatePhone: data.alternatePhone || undefined,
			address: data.address || undefined,
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent side="right" className="sm:max-w-lg">
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<SheetTitle className="text-xl">Add Client</SheetTitle>
					<Button
						size="icon"
						variant="ghost"
						onClick={close}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</SheetHeader>
				<ClientForm
					onSubmit={handleSubmit}
					mode="create"
					isPending={createMutation.isPending}
				/>
			</SheetContent>
		</Sheet>
	);
}
