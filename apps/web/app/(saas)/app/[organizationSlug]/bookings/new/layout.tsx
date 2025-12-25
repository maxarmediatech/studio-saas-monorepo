"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/button";
import { Form } from "@repo/ui/components/form";
import {
	BOOKING_TABS,
	BookingFormLayout,
	BookingFormNavigation,
	type BookingFormValues,
	BookingMobileStepper,
	BookingStepperSidebar,
	type BookingTab,
	bookingDeliverablesStepSchema,
	bookingDetailsStepSchema,
	bookingFormSchema,
	bookingPaymentsStepSchema,
	bookingShootsStepSchema,
	defaultBookingValues,
	TAB_FIELD_MAPPING,
} from "@saas/studio/components/bookings";
import {
	useBookingFormHydrated,
	useBookingFormStore,
} from "@saas/studio/components/bookings/booking-form/store/use-booking-form-store";
import { bookingsMutations, studioQueryKeys } from "@saas/studio/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
	type PropsWithChildren,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from "react";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";

const BOOKING_FORM_HTML_ID = "booking-form";

const resolverByStep: Record<BookingTab, Resolver<BookingFormValues>> = {
	details: zodResolver(
		bookingDetailsStepSchema,
	) as unknown as Resolver<BookingFormValues>,
	shoots: zodResolver(
		bookingShootsStepSchema,
	) as unknown as Resolver<BookingFormValues>,
	payments: zodResolver(
		bookingPaymentsStepSchema,
	) as unknown as Resolver<BookingFormValues>,
	deliverables: zodResolver(
		bookingDeliverablesStepSchema,
	) as unknown as Resolver<BookingFormValues>,
	review: zodResolver(
		bookingFormSchema,
	) as unknown as Resolver<BookingFormValues>,
};

export default function NewBookingLayout({ children }: PropsWithChildren) {
	const router = useRouter();
	const pathname = usePathname();
	const params = useParams<{ organizationSlug: string }>();
	const organizationSlug = params.organizationSlug;

	const {
		formData,
		setFormData,
		completedSteps,
		setStepCompleted,
		resetForm,
	} = useBookingFormStore();
	const hasHydrated = useBookingFormHydrated();

	// Extract current step from URL path
	const pathSegments = pathname.split("/");
	const currentStep = pathSegments[pathSegments.length - 1] as BookingTab;
	const currentIndex = BOOKING_TABS.indexOf(currentStep);

	// Determine if we're on a valid step
	const isValidStep = BOOKING_TABS.includes(currentStep);
	const isFirstStep = currentIndex === 0;
	const isLastStep = currentIndex === BOOKING_TABS.length - 1;

	const currentStepRef = useRef<BookingTab>("details");
	if (isValidStep) {
		currentStepRef.current = currentStep;
	}

	const resolver = useCallback<Resolver<BookingFormValues>>(
		async (values, context, options) => {
			const activeStep = currentStepRef.current;

			if (activeStep === "review") {
				return resolverByStep.review(values, context, options);
			}

			const firstName = options.names?.[0];
			if (!firstName) {
				return resolverByStep[activeStep](values, context, options);
			}

			const rootField = String(firstName).split(
				".",
			)[0] as keyof BookingFormValues;
			const inferredStep = (
				Object.keys(TAB_FIELD_MAPPING) as BookingTab[]
			).find((step) => TAB_FIELD_MAPPING[step].includes(rootField));

			return resolverByStep[inferredStep ?? activeStep](
				values,
				context,
				options,
			);
		},
		[],
	);

	const form = useForm<BookingFormValues>({
		resolver,
		defaultValues: defaultBookingValues,
		mode: "onChange",
	});

	const didInitFromStoreRef = useRef(false);
	useEffect(() => {
		if (!hasHydrated || didInitFromStoreRef.current) {
			return;
		}

		form.reset({ ...defaultBookingValues, ...formData });
		didInitFromStoreRef.current = true;
	}, [form, formData, hasHydrated]);

	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
	useEffect(() => {
		if (!hasHydrated || !didInitFromStoreRef.current) {
			return;
		}

		const subscription = form.watch((data) => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}

			debounceTimerRef.current = setTimeout(() => {
				setFormData(data as Partial<BookingFormValues>);
			}, 300);
		});

		return () => {
			subscription.unsubscribe();
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, [form, hasHydrated, setFormData]);

	// Memoize Set creation to prevent unnecessary re-renders
	const completedStepsSet = useMemo(
		() => new Set<BookingTab>(completedSteps),
		[completedSteps],
	);

	const getStepFieldError = useCallback(
		(step: BookingTab) => {
			const rootFieldsWithErrors = new Set(
				Object.keys(
					form.formState.errors,
				) as (keyof BookingFormValues)[],
			);
			return TAB_FIELD_MAPPING[step].some((field) =>
				rootFieldsWithErrors.has(field),
			);
		},
		[form.formState.errors],
	);

	const stepsWithErrors = useMemo<Record<BookingTab, boolean>>(() => {
		return {
			details: getStepFieldError("details"),
			shoots: getStepFieldError("shoots"),
			payments: getStepFieldError("payments"),
			deliverables: getStepFieldError("deliverables"),
			review: getStepFieldError("review"),
		};
	}, [getStepFieldError]);

	const canNavigateToStep = useCallback(
		(step: BookingTab) => {
			const targetIndex = BOOKING_TABS.indexOf(step);
			if (targetIndex === -1) {
				return false;
			}

			if (!isValidStep) {
				return false;
			}

			if (targetIndex < currentIndex) {
				return true;
			}

			for (let i = 0; i < targetIndex; i += 1) {
				const requiredStep = BOOKING_TABS[i];
				if (!completedStepsSet.has(requiredStep)) {
					return false;
				}
			}

			return true;
		},
		[completedStepsSet, currentIndex, isValidStep],
	);

	useEffect(() => {
		if (!hasHydrated || !isValidStep) {
			return;
		}

		if (canNavigateToStep(currentStep)) {
			return;
		}

		const firstIncompleteStep = BOOKING_TABS.find(
			(step) => !completedStepsSet.has(step),
		);

		router.replace(
			`/app/${organizationSlug}/bookings/new/${firstIncompleteStep ?? "details"}`,
		);
	}, [
		canNavigateToStep,
		completedStepsSet,
		currentStep,
		hasHydrated,
		isValidStep,
		organizationSlug,
		router,
	]);

	// Navigation handlers
	const handleStepClick = (step: BookingTab) => {
		if (!canNavigateToStep(step)) {
			return;
		}
		router.push(`/app/${organizationSlug}/bookings/new/${step}`);
	};

	const handleNext = async () => {
		if (!isValidStep) {
			return;
		}

		const fieldsToValidate = TAB_FIELD_MAPPING[currentStep];
		const isCurrentStepValid = await form.trigger(fieldsToValidate, {
			shouldFocus: true,
		});

		if (!isCurrentStepValid) {
			return;
		}

		setStepCompleted(currentStep);

		if (currentIndex < BOOKING_TABS.length - 1) {
			const nextStep = BOOKING_TABS[currentIndex + 1];
			router.push(`/app/${organizationSlug}/bookings/new/${nextStep}`);
		}
	};

	const handlePrevious = () => {
		if (currentIndex > 0) {
			const prevStep = BOOKING_TABS[currentIndex - 1];
			router.push(`/app/${organizationSlug}/bookings/new/${prevStep}`);
		}
	};

	const handleCancel = () => {
		router.push(`/app/${organizationSlug}/bookings`);
	};

	const queryClient = useQueryClient();
	const createMutation = useMutation({
		...bookingsMutations.create(),
		onSuccess: (data) => {
			resetForm();
			form.reset(defaultBookingValues);

			toast.success("Booking created successfully", {
				action: {
					label: "View",
					onClick: () =>
						router.push(
							`/app/${params.organizationSlug}/bookings/${data.data.id}`,
						),
				},
			});

			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.bookings.all,
			});

			router.push(`/app/${params.organizationSlug}/bookings`);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create booking");
		},
	});

	// Show loading state until hydrated to prevent hydration mismatch
	if (!hasHydrated) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	// If not a valid step, just render children (will be handled by the page)
	if (!isValidStep) {
		return <>{children}</>;
	}

	return (
		<Form {...form}>
			<form
				id={BOOKING_FORM_HTML_ID}
				onSubmit={form.handleSubmit((values) => {
					if (!isLastStep) {
						return;
					}

					createMutation.mutate({
						name: values.name,
						bookingType: values.bookingType,
						packageType: values.packageType,
						packageCost: values.packageCost,
						note: values.note,
						participants: values.participants,
						events: values.events,
						// Include shoots with crew assignments
						shoots: values.shoots?.map((shoot) => ({
							name: shoot.name,
							shootType: shoot.shootType,
							shootDate: shoot.shootDate,
							startTime: shoot.startTime,
							endTime: shoot.endTime,
							venue: shoot.venue,
							venueAddress: shoot.venueAddress,
							notes: shoot.notes,
							crewAssignments: shoot.crewAssignments?.map((a) => ({
								crewId: a.crewId,
								role: a.role,
								isLead: a.isLead ?? false,
							})),
						})),
						// Include deliverables with crew assignments
						deliverables: values.deliverables?.map((del) => ({
							name: del.name,
							deliverableType: del.deliverableType,
							description: del.description,
							dueDate: del.dueDate,
							crewAssignments: del.crewAssignments?.map((a) => ({
								crewId: a.crewId,
								isLead: a.isLead ?? false,
							})),
						})),
						// Include received payments
						receivedPayments: values.payments?.map((p) => ({
							amount: p.amount,
							paymentMethod: p.paymentMethod,
							receivedDate: p.receivedDate,
							transactionReference: p.transactionReference,
							notes: p.notes,
						})),
						// Include payment schedules
						paymentSchedules: values.paymentSchedules?.map((s, idx) => ({
							name: s.name,
							amount: s.amount,
							dueDate: s.dueDate,
							notes: s.notes,
							sortOrder: idx,
						})),
					});
				})}
			>
				<div className="space-y-6">
					{/* Header */}
					<div className="flex items-center gap-4">
						<Button variant="ghost" size="icon" asChild>
							<Link href={`/app/${organizationSlug}/bookings`}>
								<ArrowLeftIcon className="h-4 w-4" />
							</Link>
						</Button>
						<div>
							<h1 className="text-2xl font-semibold tracking-tight">
								New Booking
							</h1>
							<p className="text-muted-foreground">
								Create a new booking for your studio
							</p>
						</div>
					</div>

					{/* Form Layout */}
					<BookingFormLayout
						stepper={
							<BookingStepperSidebar
								activeStep={currentStep}
								completedSteps={completedStepsSet}
								stepsWithErrors={stepsWithErrors}
								onStepClick={handleStepClick}
								canNavigateToStep={canNavigateToStep}
								isNavigating={false}
							/>
						}
						mobileStepper={
							<BookingMobileStepper
								activeStep={currentStep}
								completedSteps={completedStepsSet}
								stepsWithErrors={stepsWithErrors}
								onStepClick={handleStepClick}
								canNavigateToStep={canNavigateToStep}
								isNavigating={false}
							/>
						}
						footer={
							<BookingFormNavigation
								onPrevious={handlePrevious}
								onNext={() => void handleNext()}
								onCancel={handleCancel}
								isFirstStep={isFirstStep}
								isLastStep={isLastStep}
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
