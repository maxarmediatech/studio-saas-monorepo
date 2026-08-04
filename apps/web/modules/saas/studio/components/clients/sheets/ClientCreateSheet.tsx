"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useClientCallback } from "@saas/studio/hooks/params/client-callback-context";
import { useClientParams } from "@saas/studio/hooks/params/use-client-params";
import { clientsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ClientForm, type ClientFormValues } from "../ClientForm";

export function ClientCreateSheet() {
	const pathname = usePathname();
	const lifecycleStage = pathname.endsWith("/leads") ? "lead" : "client";
	const contactLabel = lifecycleStage === "lead" ? "Lead" : "Client";
	const { createClient, close } = useClientParams();
	const { executeCallback, clearCallback } = useClientCallback();
	const isOpen = Boolean(createClient);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const createMutation = useMutation({
		...clientsMutations.create(),
		onSuccess: (data) => {
			toast.success(`${contactLabel} added successfully`);
			// Use ORPC's key generator to match the booking form's query keys
			queryClient.invalidateQueries({
				queryKey: orpc.clients.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
			});
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
		if (data.profession) {
			metadata.profession = data.profession;
		}
		if (data.source) {
			metadata.source = data.source;
		}
		if (data.socialHandle) {
			metadata.socialHandle = data.socialHandle;
		}
		if (data.notes) {
			metadata.notes = data.notes;
		}

		await createMutation.mutateAsync({
			name: data.name,
			lifecycleStage,
			email: data.email || undefined,
			phoneNumber: data.phoneNumber || undefined,
			alternatePhone: data.alternatePhone || undefined,
			address: data.address || undefined,
			metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
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
						Add {contactLabel}
					</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					<ClientForm
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
