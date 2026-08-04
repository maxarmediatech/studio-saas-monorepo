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
	createDefaultBookingValues,
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
		bookingDate: values.bookingDate,
		bookingType: values.bookingType,
		packageType: values.packageType,
		packageCost: formatDecimalForApi(values.packageCost),
		note: values.note,
		participants: values.participants,
		contractAttachment: values.contractAttachment ?? null,
		shoots: values.shoots?.map((shoot) => ({
			// API requires name - use shootType as the name
			name: shoot.shootType,
			shootType: shoot.shootType,
			side: shoot.side,
			shootDate: shoot.shootDate,
			startTime: shoot.startTime || undefined,
			// endTime removed from form (Indian weddings have flexible end times)
			endTime: undefined,
			// location field maps to venueAddress (supports up to 500 chars for links/addresses)
			venue: undefined,
			venueAddress: shoot.location,
			notes: shoot.notes,
			requiredCrewCount: shoot.requiredCrewCount?.trim()
				? Number.parseInt(shoot.requiredCrewCount, 10)
				: undefined,
			additionalServices: shoot.additionalServices ?? [],
			// Role is auto-filled from crew profile by API
			crewAssignments: shoot.crewAssignments?.map((assignment) => ({
				crewId: assignment.crewId,
				rate: assignment.rate || undefined, // Per-shoot rate (optional)
			})),
		})),
		deliverables: values.deliverables?.map((deliverable) => ({
			name: deliverable.name,
			description: deliverable.description,
			dueDate: deliverable.dueDate || undefined,
			quantity: deliverable.quantity ?? 1,
			cost: deliverable.cost
				? formatDecimalForApi(deliverable.cost)
				: undefined,
			isPackageIncluded: deliverable.isPackageIncluded ?? false,
			// Simplified to just crewId
			crewAssignments: deliverable.crewAssignments?.map((assignment) => ({
				crewId: assignment.crewId,
			})),
		})),
		receivedPayments: values.payments?.map((payment) => ({
			amount: formatDecimalForApi(payment.amount),
			paymentMethod: payment.paymentMethod,
			receivedDate: payment.receivedDate,
			transactionReference: payment.transactionReference,
			notes: payment.notes,
			proofAttachment: payment.proofAttachment ?? null,
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
	const [isFormInitialized, setIsFormInitialized] = useState(false);
	const [formResetKey, setFormResetKey] = useState(0);

	const form = useForm<BookingFormValues>({
		resolver: zodResolver(
			bookingFormSchema,
		) as unknown as Resolver<BookingFormValues>,
		defaultValues: createDefaultBookingValues(),
		mode: "onChange",
	});

	// Initialize form from store on hydration and revalidate steps
	const didInitFromStoreRef = useRef(false);
	useEffect(() => {
		if (!hasHydrated || didInitFromStoreRef.current) {
			return;
		}
		const storedFormData = useBookingFormStore.getState().formData;
		form.reset({ ...createDefaultBookingValues(), ...storedFormData });
		// Re-validate completed steps to filter out stale ones
		revalidateSteps();
		didInitFromStoreRef.current = true;
		setIsFormInitialized(true);
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
			form.reset(createDefaultBookingValues());
			setFormResetKey((key) => key + 1);
			// Reset the init ref so form can re-initialize if user comes back
			didInitFromStoreRef.current = false;
			setIsFormInitialized(true);

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
		const isValid = await form.trigger(undefined, { shouldFocus: true });
		if (!isValid) {
			toast.error("Please fix validation errors before submitting");
			return;
		}

		// Clear previous API errors before submitting
		clearApiErrors(form.clearErrors);

		const values = form.getValues();
		createMutation.mutate(buildCreateBookingInput(values));
	};

	// Go to review step from sidebar
	const handleGoToReview = async () => {
		const didNavigate = await wizard.goToReview();
		if (!didNavigate) {
			toast.error("Please fix validation errors before reviewing");
		}
	};

	// Reset form and go back to first step
	const handleReset = () => {
		resetForm();
		form.reset(createDefaultBookingValues());
		setFormResetKey((key) => key + 1);
		// Store and form are already in sync after reset.
		didInitFromStoreRef.current = true;
		setIsFormInitialized(true);
		router.push(`/app/${wizard.organizationSlug}/bookings/new/details`);
	};

	// Show loading state until hydrated
	if (!hasHydrated || !isFormInitialized) {
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
				<div
					key={formResetKey}
					className="flex min-h-0 flex-1 flex-col"
				>
					<BookingFormLayout
						className="flex-1"
						backHref={`/app/${wizard.organizationSlug}/bookings`}
						stepName={TAB_LABELS[wizard.currentStep]}
						validationErrorMessage={wizard.validationErrorMessage}
						onCancel={handleCancelWithConfirmation}
						stepper={
							<BookingStepperSidebar
								activeStep={wizard.currentStep}
								completedSteps={wizard.completedStepsSet}
								stepsWithErrors={wizard.stepsWithErrors}
								onStepClick={(step) => {
									if (step === "review") {
										return handleGoToReview();
									}
									return wizard.goToStep(step);
								}}
								canNavigateToStep={wizard.canNavigateToStep}
								isNavigating={false}
								isSaving={wizard.isSaving}
								lastSavedAt={lastSavedAt}
								primaryActionLabel={
									wizard.currentStep === "review"
										? "Submit"
										: "Review & Submit"
								}
								onPrimaryAction={() => {
									if (wizard.currentStep === "review") {
										void handleQuickSubmit();
										return;
									}
									void handleGoToReview();
								}}
								onReset={handleReset}
								isSubmitting={createMutation.isPending}
							/>
						}
						mobileStepper={
							<BookingMobileStepper
								activeStep={wizard.currentStep}
								completedSteps={wizard.completedStepsSet}
								stepsWithErrors={wizard.stepsWithErrors}
								onStepClick={(step) => {
									if (step === "review") {
										return handleGoToReview();
									}
									return wizard.goToStep(step);
								}}
								canNavigateToStep={wizard.canNavigateToStep}
								isNavigating={false}
							/>
						}
						footer={
							<BookingFormNavigation
								onPrevious={wizard.previous}
								onNext={() => void wizard.next()}
								onSkip={wizard.skip}
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
