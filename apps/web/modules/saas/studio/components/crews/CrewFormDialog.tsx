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
import { Button } from "@repo/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Loader2Icon } from "lucide-react";
import { crewsMutations } from "@saas/studio/lib/api";
import type { Crew } from "@repo/api/modules/studio/schemas/crew";

const crewFormSchema = z.object({
	name: z.string().min(1, "Name is required").max(255),
	email: z.string().email("Invalid email").optional().or(z.literal("")),
	phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").optional().or(z.literal("")),
	role: z.string().min(1, "Role is required").max(100),
	status: z.string().min(1, "Status is required"),
	dailyRate: z.string().optional().or(z.literal("")),
});

type CrewFormValues = z.infer<typeof crewFormSchema>;

// Common crew roles - these will later come from configurations
const CREW_ROLES = [
	{ value: "lead_photographer", label: "Lead Photographer" },
	{ value: "photographer", label: "Photographer" },
	{ value: "lead_videographer", label: "Lead Videographer" },
	{ value: "videographer", label: "Videographer" },
	{ value: "drone_operator", label: "Drone Operator" },
	{ value: "assistant", label: "Assistant" },
	{ value: "editor", label: "Editor" },
	{ value: "member", label: "Member" },
];

const CREW_STATUSES = [
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
	{ value: "unavailable", label: "Unavailable" },
];

interface CrewFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	crew: Crew | null;
	onSuccess: () => void;
}

export function CrewFormDialog({
	open,
	onOpenChange,
	crew,
	onSuccess,
}: CrewFormDialogProps) {
	const isEditing = !!crew;

	const form = useForm<CrewFormValues>({
		resolver: zodResolver(crewFormSchema),
		defaultValues: {
			name: "",
			email: "",
			phoneNumber: "",
			role: "",
			status: "active",
			dailyRate: "",
		},
	});

	// Reset form when dialog opens/closes or crew changes
	useEffect(() => {
		if (open) {
			if (crew) {
				form.reset({
					name: crew.name,
					email: crew.email ?? "",
					phoneNumber: crew.phoneNumber ?? "",
					role: crew.role,
					status: crew.status,
					dailyRate: crew.dailyRate ?? "",
				});
			} else {
				form.reset({
					name: "",
					email: "",
					phoneNumber: "",
					role: "",
					status: "active",
					dailyRate: "",
				});
			}
		}
	}, [open, crew, form]);

	const createMutation = useMutation({
		...crewsMutations.create(),
		onSuccess: () => {
			toast.success("Crew member added successfully");
			onSuccess();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to add crew member");
		},
	});

	const updateMutation = useMutation({
		...crewsMutations.update(),
		onSuccess: () => {
			toast.success("Crew member updated successfully");
			onSuccess();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update crew member");
		},
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	const onSubmit = (values: CrewFormValues) => {
		if (isEditing && crew) {
			updateMutation.mutate({
				id: crew.id,
				name: values.name,
				email: values.email || null,
				phoneNumber: values.phoneNumber || null,
				role: values.role,
				status: values.status,
				dailyRate: values.dailyRate || null,
			});
		} else {
			createMutation.mutate({
				name: values.name,
				email: values.email || undefined,
				phoneNumber: values.phoneNumber || undefined,
				role: values.role,
				status: values.status,
				dailyRate: values.dailyRate || undefined,
			});
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Edit Crew Member" : "Add Crew Member"}
					</DialogTitle>
					<DialogDescription>
						{isEditing
							? "Update the crew member's information."
							: "Add a new crew member to your team."}
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
										<Input placeholder="Enter name" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid grid-cols-2 gap-4">
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
						</div>

						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="role"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Role *</FormLabel>
										<Select
											onValueChange={field.onChange}
											value={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select role" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{CREW_ROLES.map((role) => (
													<SelectItem key={role.value} value={role.value}>
														{role.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="status"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Status *</FormLabel>
										<Select
											onValueChange={field.onChange}
											value={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select status" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{CREW_STATUSES.map((status) => (
													<SelectItem key={status.value} value={status.value}>
														{status.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="dailyRate"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Daily Rate (INR)</FormLabel>
									<FormControl>
										<Input
											type="number"
											placeholder="5000"
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
								{isEditing ? "Save Changes" : "Add Member"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
