"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Loader2Icon } from "lucide-react";
import { bookingsApi } from "@saas/studio/lib/api";
import type { DeliverableDetail } from "@repo/api/modules/studio/schemas/deliverable";

const DELIVERABLE_TYPES = [
	{ value: "wedding_album", label: "Wedding Album" },
	{ value: "pre_wedding_album", label: "Pre-Wedding Album" },
	{ value: "photo_album", label: "Photo Album" },
	{ value: "highlight_video", label: "Highlight Video" },
	{ value: "full_video", label: "Full Video" },
	{ value: "teaser", label: "Teaser" },
	{ value: "reel", label: "Reel" },
	{ value: "edited_photos", label: "Edited Photos" },
	{ value: "raw_photos", label: "Raw Photos" },
	{ value: "raw_videos", label: "Raw Videos" },
	{ value: "drone_footage", label: "Drone Footage" },
	{ value: "frame", label: "Frame" },
	{ value: "canvas", label: "Canvas" },
	{ value: "other", label: "Other" },
] as const;

const deliverableFormSchema = z.object({
	bookingId: z.string().min(1, "Booking is required"),
	name: z.string().min(1, "Name is required").max(255),
	deliverableType: z.string().min(1, "Type is required"),
	description: z.string().max(5000).optional().or(z.literal("")),
	dueDate: z.string().optional().or(z.literal("")),
	status: z.string().max(50).optional().or(z.literal("")),
	priority: z.string().max(50).optional().or(z.literal("")),
});

export type DeliverableFormValues = z.infer<typeof deliverableFormSchema>;

interface DeliverableFormProps {
	defaultValues?: DeliverableDetail;
	onSubmit: (data: DeliverableFormValues) => Promise<void>;
	mode: "create" | "edit";
	isPending?: boolean;
}

export function DeliverableForm({
	defaultValues,
	onSubmit,
	mode,
	isPending = false,
}: DeliverableFormProps) {
	const form = useForm<DeliverableFormValues>({
		resolver: zodResolver(deliverableFormSchema),
		defaultValues: {
			bookingId: "",
			name: "",
			deliverableType: "",
			description: "",
			dueDate: "",
			status: "",
			priority: "",
		},
	});

	// Fetch bookings for dropdown
	const { data: bookingsData, isLoading: isLoadingBookings } = useQuery(
		bookingsApi.listMinimalOptions({})
	);

	const bookings = bookingsData?.data ?? [];

	// Reset form when defaultValues change (for edit mode)
	useEffect(() => {
		if (defaultValues) {
			form.reset({
				bookingId: defaultValues.bookingId,
				name: defaultValues.name,
				deliverableType: defaultValues.deliverableType,
				description: defaultValues.description ?? "",
				dueDate: defaultValues.dueDate?.split("T")[0] ?? "",
				status: defaultValues.status ?? "",
				priority: defaultValues.priority ?? "",
			});
		}
	}, [defaultValues, form]);

	const isSubmitting = form.formState.isSubmitting || isPending;

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="bookingId"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Booking *</FormLabel>
							<Select
								onValueChange={field.onChange}
								value={field.value}
								disabled={mode === "edit"}
							>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder={isLoadingBookings ? "Loading..." : "Select a booking"} />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{bookings.map((booking) => (
										<SelectItem key={booking.id} value={booking.id}>
											{booking.name} ({booking.referenceNumber})
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
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Name *</FormLabel>
							<FormControl>
								<Input placeholder="Enter deliverable name" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="deliverableType"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Type *</FormLabel>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{DELIVERABLE_TYPES.map((type) => (
										<SelectItem key={type.value} value={type.value}>
											{type.label}
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
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Description</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Enter description"
									className="resize-none"
									rows={3}
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="dueDate"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Due Date</FormLabel>
							<FormControl>
								<Input type="date" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="grid grid-cols-2 gap-4">
					<FormField
						control={form.control}
						name="status"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Status</FormLabel>
								<FormControl>
									<Input placeholder="e.g., pending" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="priority"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Priority</FormLabel>
								<FormControl>
									<Input placeholder="e.g., high" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<div className="flex justify-end pt-4">
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting && (
							<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
						)}
						{mode === "edit" ? "Save Changes" : "Add Deliverable"}
					</Button>
				</div>
			</form>
		</Form>
	);
}
