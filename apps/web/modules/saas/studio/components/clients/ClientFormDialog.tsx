"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { Button } from "@repo/ui/components/button";
import { Loader2Icon } from "lucide-react";
import { clientsMutations } from "@saas/studio/lib/api";
import type { Client } from "@repo/api/modules/studio/schemas/client";

const clientFormSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	email: z.string().email("Invalid email").optional().or(z.literal("")),
	phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").optional().or(z.literal("")),
	alternatePhone: z.string().min(10, "Phone number must be at least 10 digits").optional().or(z.literal("")),
	address: z.string().max(1000).optional().or(z.literal("")),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

interface ClientFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	client: Client | null;
	onSuccess: () => void;
}

export function ClientFormDialog({
	open,
	onOpenChange,
	client,
	onSuccess,
}: ClientFormDialogProps) {
	const isEditing = !!client;

	const form = useForm<ClientFormValues>({
		resolver: zodResolver(clientFormSchema),
		defaultValues: {
			name: "",
			email: "",
			phoneNumber: "",
			alternatePhone: "",
			address: "",
		},
	});

	// Reset form when dialog opens/closes or client changes
	useEffect(() => {
		if (open) {
			if (client) {
				form.reset({
					name: client.name,
					email: client.email ?? "",
					phoneNumber: client.phoneNumber ?? "",
					alternatePhone: client.alternatePhone ?? "",
					address: client.address ?? "",
				});
			} else {
				form.reset({
					name: "",
					email: "",
					phoneNumber: "",
					alternatePhone: "",
					address: "",
				});
			}
		}
	}, [open, client, form]);

	const createMutation = useMutation({
		...clientsMutations.create(),
		onSuccess: () => {
			toast.success("Client added successfully");
			onSuccess();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to add client");
		},
	});

	const updateMutation = useMutation({
		...clientsMutations.update(),
		onSuccess: () => {
			toast.success("Client updated successfully");
			onSuccess();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update client");
		},
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	const onSubmit = (values: ClientFormValues) => {
		if (isEditing && client) {
			updateMutation.mutate({
				id: client.id,
				name: values.name,
				email: values.email || null,
				phoneNumber: values.phoneNumber || null,
				alternatePhone: values.alternatePhone || null,
				address: values.address || null,
			});
		} else {
			createMutation.mutate({
				name: values.name,
				email: values.email || undefined,
				phoneNumber: values.phoneNumber || undefined,
				alternatePhone: values.alternatePhone || undefined,
				address: values.address || undefined,
			});
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Edit Client" : "Add Client"}
					</DialogTitle>
					<DialogDescription>
						{isEditing
							? "Update the client's contact information."
							: "Add a new client to your CRM."}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name *</FormLabel>
									<FormControl>
										<Input placeholder="Enter client name" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email</FormLabel>
									<FormControl>
										<Input
											type="email"
											placeholder="email@example.com"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="phoneNumber"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Phone</FormLabel>
										<FormControl>
											<Input placeholder="+91 9876543210" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="alternatePhone"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Alternate Phone</FormLabel>
										<FormControl>
											<Input placeholder="+91 9876543210" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="address"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Address</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Enter full address"
											className="resize-none"
											rows={3}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={isPending}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending && (
									<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
								)}
								{isEditing ? "Save Changes" : "Add Client"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
