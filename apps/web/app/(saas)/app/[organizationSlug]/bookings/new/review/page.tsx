"use client";

import { Form } from "@repo/ui/components/form";
import {
	BookingReviewStep,
	type BookingFormValues,
	type BookingTab,
	useBookingFormStore,
} from "@saas/studio/components/bookings";
import { bookingsMutations, studioQueryKeys } from "@saas/studio/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

export default function ReviewPage() {
	const router = useRouter();
	const params = useParams<{ organizationSlug: string }>();
	const queryClient = useQueryClient();
	const { formData, resetForm, setStepCompleted } = useBookingFormStore();

	// Create a form instance for the review step (needed for FormProvider)
	const form = useForm<BookingFormValues>({
		defaultValues: formData,
	});

	// Mark review step as completed (must be in useEffect, not during render!)
	useEffect(() => {
		setStepCompleted("review");
	}, [setStepCompleted]);

	const createMutation = useMutation({
		...bookingsMutations.create(),
		onSuccess: (data) => {
			// Clear the draft from localStorage
			resetForm();

			toast.success("Booking created successfully", {
				action: {
					label: "View",
					onClick: () =>
						router.push(
							`/app/${params.organizationSlug}/bookings/${data.data.id}`,
						),
				},
			});

			// Invalidate bookings list
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.bookings.all,
			});

			// Navigate to bookings list
			router.push(`/app/${params.organizationSlug}/bookings`);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create booking");
		},
	});

	const handleSubmit = () => {
		createMutation.mutate({
			name: formData.name,
			bookingType: formData.bookingType,
			packageType: formData.packageType,
			packageCost: formData.packageCost,
			note: formData.note,
			participants: formData.participants,
			events: formData.events,
		});
	};

	const handleNavigateToStep = (step: BookingTab) => {
		router.push(`/app/${params.organizationSlug}/bookings/new/${step}`);
	};

	return (
		<Form {...form}>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
			>
				<BookingReviewStep onNavigateToStep={handleNavigateToStep} />
			</form>
		</Form>
	);
}
