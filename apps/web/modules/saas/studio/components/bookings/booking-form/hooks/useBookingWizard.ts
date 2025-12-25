"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
	BOOKING_TABS,
	type BookingFormValues,
	type BookingTab,
	TAB_FIELD_MAPPING,
} from "../booking-form-schema";
import {
	useBookingFormHydrated,
	useBookingFormStore,
} from "../store/use-booking-form-store";

interface UseBookingWizardOptions {
	form: UseFormReturn<BookingFormValues>;
}

export function useBookingWizard({ form }: UseBookingWizardOptions) {
	const router = useRouter();
	const pathname = usePathname();
	const params = useParams<{ organizationSlug: string }>();
	const organizationSlug = params.organizationSlug;

	const hasHydrated = useBookingFormHydrated();
	const setFormData = useBookingFormStore((state) => state.setFormData);
	const setStepCompleted = useBookingFormStore(
		(state) => state.setStepCompleted,
	);
	const completedSteps = useBookingFormStore((state) => state.completedSteps);

	// Extract current step from URL path
	const pathSegments = pathname.split("/");
	const currentStep = pathSegments[pathSegments.length - 1] as BookingTab;
	const currentIndex = BOOKING_TABS.indexOf(currentStep);

	// Step status
	const isValidStep = BOOKING_TABS.includes(currentStep);
	const isFirstStep = currentIndex === 0;
	const isLastStep = currentIndex === BOOKING_TABS.length - 1;

	// Memoize completed steps set
	const completedStepsSet = useMemo(
		() => new Set<BookingTab>(completedSteps),
		[completedSteps],
	);

	// Check if a field has errors
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

	// Get error status for all steps
	const stepsWithErrors = useMemo<Record<BookingTab, boolean>>(() => {
		return {
			details: getStepFieldError("details"),
			shoots: getStepFieldError("shoots"),
			payments: getStepFieldError("payments"),
			deliverables: getStepFieldError("deliverables"),
			review: getStepFieldError("review"),
		};
	}, [getStepFieldError]);

	// Check if navigation to a step is allowed
	const canNavigateToStep = useCallback(
		(step: BookingTab) => {
			const targetIndex = BOOKING_TABS.indexOf(step);
			if (targetIndex === -1 || !isValidStep) {
				return false;
			}

			// Always allow backward navigation
			if (targetIndex < currentIndex) {
				return true;
			}

			// For forward navigation, check all previous steps are completed
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

	// Save form data to store
	const saveFormData = useCallback(() => {
		setFormData(form.getValues());
	}, [form, setFormData]);

	const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
	useEffect(() => {
		if (!hasHydrated) {
			return;
		}

		const subscription = form.watch((data) => {
			if (autoSaveTimerRef.current) {
				clearTimeout(autoSaveTimerRef.current);
			}

			autoSaveTimerRef.current = setTimeout(() => {
				setFormData(data as Partial<BookingFormValues>);
			}, 300);
		});

		return () => {
			subscription.unsubscribe();
			if (autoSaveTimerRef.current) {
				clearTimeout(autoSaveTimerRef.current);
			}

			saveFormData();
		};
	}, [form, hasHydrated, saveFormData, setFormData]);

	useEffect(() => {
		if (!hasHydrated) {
			return;
		}

		const flush = () => {
			if (autoSaveTimerRef.current) {
				clearTimeout(autoSaveTimerRef.current);
				autoSaveTimerRef.current = null;
			}

			saveFormData();
		};

		window.addEventListener("beforeunload", flush);
		window.addEventListener("pagehide", flush);

		return () => {
			window.removeEventListener("beforeunload", flush);
			window.removeEventListener("pagehide", flush);
		};
	}, [hasHydrated, saveFormData]);

	// Navigate to a specific step
	const goToStep = useCallback(
		(step: BookingTab) => {
			if (!canNavigateToStep(step)) {
				return;
			}
			saveFormData();
			router.push(`/app/${organizationSlug}/bookings/new/${step}`);
		},
		[canNavigateToStep, organizationSlug, router, saveFormData],
	);

	// Navigate to next step (with validation)
	const next = useCallback(async () => {
		if (!isValidStep) {
			return false;
		}

		const fieldsToValidate = TAB_FIELD_MAPPING[currentStep];
		const isCurrentStepValid = await form.trigger(fieldsToValidate, {
			shouldFocus: true,
		});

		if (!isCurrentStepValid) {
			return false;
		}

		setStepCompleted(currentStep);
		saveFormData();

		if (currentIndex < BOOKING_TABS.length - 1) {
			const nextStep = BOOKING_TABS[currentIndex + 1];
			router.push(`/app/${organizationSlug}/bookings/new/${nextStep}`);
		}

		return true;
	}, [
		currentIndex,
		currentStep,
		form,
		isValidStep,
		organizationSlug,
		router,
		saveFormData,
		setStepCompleted,
	]);

	// Navigate to previous step
	const previous = useCallback(() => {
		if (currentIndex > 0) {
			saveFormData();
			const prevStep = BOOKING_TABS[currentIndex - 1];
			router.push(`/app/${organizationSlug}/bookings/new/${prevStep}`);
		}
	}, [currentIndex, organizationSlug, router, saveFormData]);

	// Cancel and go back to bookings list
	const cancel = useCallback(() => {
		router.push(`/app/${organizationSlug}/bookings`);
	}, [organizationSlug, router]);

	// Get the first incomplete step (for redirects)
	const getFirstIncompleteStep = useCallback((): BookingTab => {
		return (
			BOOKING_TABS.find((step) => !completedStepsSet.has(step)) ??
			"details"
		);
	}, [completedStepsSet]);

	return {
		// Current state
		currentStep,
		currentIndex,
		isValidStep,
		isFirstStep,
		isLastStep,

		// Step status
		completedStepsSet,
		stepsWithErrors,

		// Navigation
		canNavigateToStep,
		goToStep,
		next,
		previous,
		cancel,
		getFirstIncompleteStep,

		// Helpers
		saveFormData,
		organizationSlug,
	};
}
