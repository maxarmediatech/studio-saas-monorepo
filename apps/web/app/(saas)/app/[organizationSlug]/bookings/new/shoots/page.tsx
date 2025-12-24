"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@repo/ui/components/form";
import {
	BookingShootsStep,
	bookingFormSchema,
	type BookingFormValues,
	useBookingFormStore,
} from "@saas/studio/components/bookings";
import { useCallback, useEffect, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";

export default function ShootsPage() {
	const { formData, setFormData, setStepCompleted } = useBookingFormStore();
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

	const form = useForm<BookingFormValues>({
		resolver: zodResolver(bookingFormSchema),
		defaultValues: formData,
		mode: "onChange",
	});

	// Debounced save to store (300ms delay)
	const debouncedSetFormData = useCallback(
		(data: Partial<BookingFormValues>) => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
			debounceTimerRef.current = setTimeout(() => {
				setFormData(data);
			}, 300);
		},
		[setFormData],
	);

	// Cleanup debounce timer on unmount
	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, []);

	// Auto-save to store on field changes (debounced)
	useEffect(() => {
		const subscription = form.watch((data) => {
			debouncedSetFormData(data as Partial<BookingFormValues>);
		});
		return () => subscription.unsubscribe();
	}, [form, debouncedSetFormData]);

	// Mark step as completed when user visits
	useEffect(() => {
		setStepCompleted("shoots");
	}, [setStepCompleted]);

	return (
		<Form {...form}>
			<FormProvider {...form}>
				<BookingShootsStep />
			</FormProvider>
		</Form>
	);
}
