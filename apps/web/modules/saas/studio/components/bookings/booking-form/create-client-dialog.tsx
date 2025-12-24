"use client";

import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { clientsMutations, studioQueryKeys } from "@saas/studio/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

export function CreateClientDialog({
	open,
	onOpenChange,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: (clientId: string) => void;
}) {
	const queryClient = useQueryClient();

	const nameId = useId();
	const phoneId = useId();
	const emailId = useId();

	const [name, setName] = useState("");
	const [phoneNumber, setPhoneNumber] = useState("");
	const [email, setEmail] = useState("");

	const createClient = useMutation({
		...clientsMutations.create(),
		onSuccess: (data) => {
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.clients.all,
			});
			onCreated(data.data.id);
			toast.success("Client created");
			onOpenChange(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create client");
		},
	});

	useEffect(() => {
		if (!open) {
			setName("");
			setPhoneNumber("");
			setEmail("");
		}
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create client</DialogTitle>
					<DialogDescription>
						Add a new client to select for this booking.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor={nameId}>Name</Label>
						<Input
							id={nameId}
							placeholder="e.g. Rahul Sharma"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>

					<div className="grid gap-2">
						<Label htmlFor={phoneId}>Phone (optional)</Label>
						<Input
							id={phoneId}
							placeholder="e.g. +91 98765 43210"
							value={phoneNumber}
							onChange={(e) => setPhoneNumber(e.target.value)}
						/>
					</div>

					<div className="grid gap-2">
						<Label htmlFor={emailId}>Email (optional)</Label>
						<Input
							id={emailId}
							placeholder="e.g. rahul@example.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={createClient.isPending}
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={() => {
							const trimmedName = name.trim();
							if (!trimmedName) {
								toast.error("Client name is required");
								return;
							}

							createClient.mutate({
								name: trimmedName,
								phoneNumber: phoneNumber.trim() || undefined,
								email: email.trim() || undefined,
							});
						}}
						disabled={createClient.isPending}
					>
						{createClient.isPending ? (
							<>
								<Loader2Icon className="h-4 w-4 animate-spin" />
								Creating...
							</>
						) : (
							"Create"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
