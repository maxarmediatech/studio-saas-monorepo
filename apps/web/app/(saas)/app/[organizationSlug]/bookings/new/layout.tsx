"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@repo/ui/components/form";
import {
	BookingFormLayout,
	BookingFormNavigation,
	type BookingFormValues,
	BookingMobileStepper,
	BookingStepperSidebar,
	bookingFormSchema,
	defaultBookingValues,
} from "@saas/studio/components/bookings";
import { useBookingWizard } from "@saas/studio/components/bookings/booking-form/hooks/useBookingWizard";
import {
	useBookingFormHydrated,
	useBookingFormStore,
} from "@saas/studio/components/bookings/booking-form/store/use-booking-form-store";
import { bookingsMutations, studioQueryKeys } from "@saas/studio/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type PropsWithChildren, useEffect, useRef } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";

const BOOKING_FORM_HTML_ID = "booking-form";

function buildCreateBookingInput(values: BookingFormValues) {
	return {
		name: values.name,
		bookingType: values.bookingType,
		packageType: values.packageType,
		packageCost: values.packageCost,
		note: values.note,
		participants: values.participants,
		events: values.events,
		shoots: values.shoots?.map((shoot) => ({
			name: shoot.name,
			shootType: shoot.shootType,
			shootDate: shoot.shootDate,
			startTime: shoot.startTime,
			endTime: shoot.endTime,
			venue: shoot.venue,
			venueAddress: shoot.venueAddress,
			notes: shoot.notes,
			crewAssignments: shoot.crewAssignments?.map((assignment) => ({
				crewId: assignment.crewId,
				role: assignment.role,
				isLead: assignment.isLead ?? false,
			})),
		})),
		deliverables: values.deliverables?.map((deliverable) => ({
			name: deliverable.name,
			deliverableType: deliverable.deliverableType,
			description: deliverable.description,
			dueDate: deliverable.dueDate,
			crewAssignments: deliverable.crewAssignments?.map((assignment) => ({
				crewId: assignment.crewId,
				isLead: assignment.isLead ?? false,
			})),
		})),
		receivedPayments: values.payments?.map((payment) => ({
			amount: payment.amount,
			paymentMethod: payment.paymentMethod,
			receivedDate: payment.receivedDate,
			transactionReference: payment.transactionReference,
			notes: payment.notes,
		})),
		paymentSchedules: values.paymentSchedules?.map((schedule, idx) => ({
			name: schedule.name,
			amount: schedule.amount,
			dueDate: schedule.dueDate,
			notes: schedule.notes,
			sortOrder: idx,
		})),
	};
}

export default function NewBookingLayout({ children }: PropsWithChildren) {
	const router = useRouter();
	const resetForm = useBookingFormStore((state) => state.resetForm);
	const hasHydrated = useBookingFormHydrated();

	const form = useForm<BookingFormValues>({
		resolver: zodResolver(
			bookingFormSchema,
		) as unknown as Resolver<BookingFormValues>,
		defaultValues: defaultBookingValues,
		mode: "onChange",
	});

	// Initialize form from store on hydration
	const didInitFromStoreRef = useRef(false);
	useEffect(() => {
		if (!hasHydrated || didInitFromStoreRef.current) {
			return;
		}
		const storedFormData = useBookingFormStore.getState().formData;
		form.reset({ ...defaultBookingValues, ...storedFormData });
		didInitFromStoreRef.current = true;
	}, [form, hasHydrated]);

	const wizard = useBookingWizard({ form });

	// Redirect to first incomplete step if trying to access invalid step
	useEffect(() => {
		if (!hasHydrated || !wizard.isValidStep) {
			return;
		}
		if (!wizard.canNavigateToStep(wizard.currentStep)) {
			const firstIncomplete = wizard.getFirstIncompleteStep();
			router.replace(
				`/app/${wizard.organizationSlug}/bookings/new/${firstIncomplete}`,
			);
		}
	}, [hasHydrated, router, wizard]);

	const queryClient = useQueryClient();
	const createMutation = useMutation({
		...bookingsMutations.create(),
		onSuccess: (data) => {
			// Reset store and form
			resetForm();
			form.reset(defaultBookingValues);
			// Reset the init ref so form can re-initialize if user comes back
			didInitFromStoreRef.current = false;

			toast.success("Booking created successfully", {
				action: {
					label: "View",
					onClick: () =>
						router.push(
							`/app/${wizard.organizationSlug}/bookings/${data.data.id}`,
						),
				},
			});

			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.bookings.all,
			});

			router.push(`/app/${wizard.organizationSlug}/bookings`);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create booking");
		},
	});

	// Quick submit from sidebar - validates full form
	const handleQuickSubmit = async () => {
		const isValid = await form.trigger();
		if (!isValid) {
			toast.error("Please fix validation errors before submitting");
			return;
		}

		const values = form.getValues();
		createMutation.mutate(buildCreateBookingInput(values));
	};

	// Reset form and go back to first step
	const handleReset = () => {
		resetForm();
		form.reset(defaultBookingValues);
		didInitFromStoreRef.current = false;
		router.push(`/app/${wizard.organizationSlug}/bookings/new/details`);
	};

	// Show loading state until hydrated
	if (!hasHydrated) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	// If not a valid step, just render children
	if (!wizard.isValidStep) {
		return <>{children}</>;
	}

	return (
		<Form {...form}>
			<form
				id={BOOKING_FORM_HTML_ID}
				onSubmit={form.handleSubmit((values) => {
					if (!wizard.isLastStep) {
						return;
					}
					createMutation.mutate(buildCreateBookingInput(values));
				})}
			>
				<div className="space-y-6">
					<BookingFormLayout
						stepper={
							<BookingStepperSidebar
								activeStep={wizard.currentStep}
								completedSteps={wizard.completedStepsSet}
								stepsWithErrors={wizard.stepsWithErrors}
								onStepClick={wizard.goToStep}
								canNavigateToStep={wizard.canNavigateToStep}
								isNavigating={false}
								onSubmit={() => void handleQuickSubmit()}
								onReset={handleReset}
								isSubmitting={createMutation.isPending}
							/>
						}
						mobileStepper={
							<BookingMobileStepper
								activeStep={wizard.currentStep}
								completedSteps={wizard.completedStepsSet}
								stepsWithErrors={wizard.stepsWithErrors}
								onStepClick={wizard.goToStep}
								canNavigateToStep={wizard.canNavigateToStep}
								isNavigating={false}
							/>
						}
						footer={
							<BookingFormNavigation
								onPrevious={wizard.previous}
								onNext={() => void wizard.next()}
								onCancel={wizard.cancel}
								isFirstStep={wizard.isFirstStep}
								isLastStep={wizard.isLastStep}
								isPending={createMutation.isPending}
								isNavigating={false}
								mode="create"
							/>
						}
					>
						{children}
					</BookingFormLayout>
				</div>
			</form>
		</Form>
	);
}
