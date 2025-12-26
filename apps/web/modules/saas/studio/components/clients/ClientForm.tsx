"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import type { Client } from "@repo/api/modules/studio/schemas/client";

const clientFormSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	email: z.string().email("Invalid email").optional().or(z.literal("")),
	phoneNumber: z
		.string()
		.min(10, "Phone number must be at least 10 digits")
		.optional()
		.or(z.literal("")),
	alternatePhone: z
		.string()
		.min(10, "Phone number must be at least 10 digits")
		.optional()
		.or(z.literal("")),
	address: z.string().max(1000).optional().or(z.literal("")),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

interface ClientFormProps {
	defaultValues?: Client;
	onSubmit: (data: ClientFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
}

export function ClientForm({
	defaultValues,
	onSubmit,
	mode,
	isPending = false,
}: ClientFormProps) {
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

	// Reset form when defaultValues change (for edit mode)
	useEffect(() => {
		if (defaultValues) {
			form.reset({
				name: defaultValues.name,
				email: defaultValues.email ?? "",
				phoneNumber: defaultValues.phoneNumber ?? "",
				alternatePhone: defaultValues.alternatePhone ?? "",
				address: defaultValues.address ?? "",
			});
		}
	}, [defaultValues, form]);

	const isSubmitting = form.formState.isSubmitting || isPending;

	return (
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

				<div className="flex justify-end pt-4">
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting && (
							<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
						)}
						{mode === "edit" ? "Save Changes" : "Add Client"}
					</Button>
				</div>
			</form>
		</Form>
	);
}
