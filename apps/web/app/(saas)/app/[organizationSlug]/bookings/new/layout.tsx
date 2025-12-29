"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Form } from "@repo/ui/components/form";
import {
	BookingFormLayout,
	BookingFormNavigation,
	BookingFormRootError,
	type BookingFormValues,
	BookingMobileStepper,
	BookingStepperSidebar,
	bookingFormSchema,
	cleanupFormArrays,
	clearApiErrors,
	defaultBookingValues,
	formatDecimalForApi,
	mapApiErrorToForm,
	TAB_LABELS,
} from "@saas/studio/components/bookings";
import { useBookingWizard } from "@saas/studio/components/bookings/booking-form/hooks/useBookingWizard";
import {
	useBookingFormHydrated,
	useBookingFormStore,
	useLastSavedAt,
} from "@saas/studio/components/bookings/booking-form/store/use-booking-form-store";
import { bookingsMutations, studioQueryKeys } from "@saas/studio/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
	type PropsWithChildren,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";

const BOOKING_FORM_HTML_ID = "booking-form";

function buildCreateBookingInput(rawValues: BookingFormValues) {
	// Clean up empty array items before submission
	const values = cleanupFormArrays(rawValues);
	return {
		name: values.name,
		bookingType: values.bookingType,
		packageType: values.packageType,
		packageCost: formatDecimalForApi(values.packageCost),
		note: values.note,
		participants: values.participants,
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
				role: assignment.role ?? "",
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
				role: assignment.role ?? "",
				isLead: assignment.isLead ?? false,
			})),
		})),
		receivedPayments: values.payments?.map((payment) => ({
			amount: formatDecimalForApi(payment.amount),
			paymentMethod: payment.paymentMethod,
			receivedDate: payment.receivedDate,
			transactionReference: payment.transactionReference,
			notes: payment.notes,
		})),
		paymentSchedules: values.paymentSchedules?.map((schedule, idx) => ({
			name: schedule.name,
			amount: formatDecimalForApi(schedule.amount),
			dueDate: schedule.dueDate,
			notes: schedule.notes,
			sortOrder: idx,
		})),
	};
}

export default function NewBookingLayout({ children }: PropsWithChildren) {
	const router = useRouter();
	const resetForm = useBookingFormStore((state) => state.resetForm);
	const revalidateSteps = useBookingFormStore(
		(state) => state.revalidateSteps,
	);
	const hasHydrated = useBookingFormHydrated();
	const lastSavedAt = useLastSavedAt();

	const form = useForm<BookingFormValues>({
		resolver: zodResolver(
			bookingFormSchema,
		) as unknown as Resolver<BookingFormValues>,
		defaultValues: defaultBookingValues,
		mode: "onChange",
	});

	// Initialize form from store on hydration and revalidate steps
	const didInitFromStoreRef = useRef(false);
	useEffect(() => {
		if (!hasHydrated || didInitFromStoreRef.current) {
			return;
		}
		const storedFormData = useBookingFormStore.getState().formData;
		form.reset({ ...defaultBookingValues, ...storedFormData });
		// Re-validate completed steps to filter out stale ones
		revalidateSteps();
		didInitFromStoreRef.current = true;
	}, [form, hasHydrated, revalidateSteps]);

	const wizard = useBookingWizard({ form });

	// Track if form has been modified (dirty state)
	const isDirty = form.formState.isDirty;
	const [showAbandonDialog, setShowAbandonDialog] = useState(false);

	// Warn users when trying to leave with unsaved changes
	useEffect(() => {
		if (!hasHydrated || !isDirty) {
			return;
		}

		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			e.preventDefault();
			// Modern browsers ignore custom messages, but returnValue is required
			e.returnValue = "";
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () =>
			window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [hasHydrated, isDirty]);

	// Handle cancel with confirmation
	const handleCancelWithConfirmation = useCallback(() => {
		if (isDirty) {
			setShowAbandonDialog(true);
		} else {
			wizard.cancel();
		}
	}, [isDirty, wizard]);

	const handleConfirmAbandon = useCallback(() => {
		setShowAbandonDialog(false);
		resetForm();
		wizard.cancel();
	}, [resetForm, wizard]);

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
			// Map API error to form fields for better user feedback
			const errorStep = mapApiErrorToForm(error, form.setError);

			// Show toast with generic message
			toast.error(
				"Failed to create booking. Please check the form for errors.",
			);

			// Navigate to the step with the error if we identified one
			if (errorStep && errorStep !== wizard.currentStep) {
				router.push(
					`/app/${wizard.organizationSlug}/bookings/new/${errorStep}`,
				);
			}
		},
	});

	// Quick submit from sidebar - validates full form
	const handleQuickSubmit = async () => {
		const isValid = await form.trigger();
		if (!isValid) {
			toast.error("Please fix validation errors before submitting");
			return;
		}

		// Clear previous API errors before submitting
		clearApiErrors(form.clearErrors);

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
			<div className="flex h-full flex-1 items-center justify-center">
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
				className="flex min-h-0 flex-1 flex-col"
				onSubmit={form.handleSubmit((values) => {
					if (!wizard.isLastStep) {
						return;
					}
					// Clear previous API errors before submitting
					clearApiErrors(form.clearErrors);
					createMutation.mutate(buildCreateBookingInput(values));
				})}
			>
				<div className="flex min-h-0 flex-1 flex-col">
					<BookingFormLayout
						className="flex-1"
						backHref={`/app/${wizard.organizationSlug}/bookings`}
						stepName={TAB_LABELS[wizard.currentStep]}
						validationErrorMessage={wizard.validationErrorMessage}
						stepper={
							<BookingStepperSidebar
								activeStep={wizard.currentStep}
								completedSteps={wizard.completedStepsSet}
								stepsWithErrors={wizard.stepsWithErrors}
								onStepClick={wizard.goToStep}
								canNavigateToStep={wizard.canNavigateToStep}
								isNavigating={false}
								isSaving={wizard.isSaving}
								lastSavedAt={lastSavedAt}
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
								onSkip={wizard.skip}
								onCancel={handleCancelWithConfirmation}
								isFirstStep={wizard.isFirstStep}
								isLastStep={wizard.isLastStep}
								isPending={createMutation.isPending}
								isNavigating={false}
								canSkip={wizard.canSkipCurrentStep}
								mode="create"
							/>
						}
					>
						{/* Show root-level API errors */}
						<BookingFormRootError
							message={form.formState.errors.root?.message}
							onDismiss={() => form.clearErrors("root")}
						/>
						{children}
					</BookingFormLayout>
				</div>
			</form>

			{/* Abandon form confirmation dialog */}
			<AlertDialog
				open={showAbandonDialog}
				onOpenChange={setShowAbandonDialog}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard changes?</AlertDialogTitle>
						<AlertDialogDescription>
							You have unsaved changes. Your draft will be saved,
							but if you leave now any in-progress data may be
							lost.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep editing</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirmAbandon}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Discard
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Form>
	);
}
