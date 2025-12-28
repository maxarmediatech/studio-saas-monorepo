"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
	BOOKING_TABS,
	type BookingFormValues,
	type BookingTab,
	TAB_FIELD_MAPPING,
	isStepOptional,
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

	// Read formState.errors at top level to properly subscribe to changes
	// (React Hook Form's formState is a Proxy - accessing in callbacks doesn't trigger re-renders)
	const { errors } = form.formState;

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
				Object.keys(errors) as (keyof BookingFormValues)[],
			);
			return TAB_FIELD_MAPPING[step].some((field) =>
				rootFieldsWithErrors.has(field),
			);
		},
		[errors],
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

	// Track saving state for UI indicator
	const [isSaving, setIsSaving] = useState(false);
	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Track validation error message for screen reader announcements
	const [validationErrorMessage, setValidationErrorMessage] = useState<string | null>(null);

	// Save form data to store with visual indicator
	const saveFormData = useCallback(() => {
		setIsSaving(true);
		setFormData(form.getValues());

		// Clear any existing timeout
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
		}

		// Show "saving" briefly then clear
		saveTimeoutRef.current = setTimeout(() => {
			setIsSaving(false);
		}, 500);
	}, [form, setFormData]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
		};
	}, []);

	// Debounced auto-save on form changes (protects against refresh/data loss)
	const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	useEffect(() => {
		if (!hasHydrated) {
			return;
		}

		const subscription = form.watch(() => {
			// Clear any existing debounce timer
			if (autoSaveTimeoutRef.current) {
				clearTimeout(autoSaveTimeoutRef.current);
			}

			// Debounce auto-save by 2 seconds to avoid excessive writes
			autoSaveTimeoutRef.current = setTimeout(() => {
				saveFormData();
			}, 2000);
		});

		return () => {
			subscription.unsubscribe();
			if (autoSaveTimeoutRef.current) {
				clearTimeout(autoSaveTimeoutRef.current);
			}
		};
	}, [form, hasHydrated, saveFormData]);

	// Save on beforeunload/pagehide (emergency save)
	useEffect(() => {
		if (!hasHydrated) {
			return;
		}

		const emergencySave = () => {
			// Synchronous save without visual indicator
			setFormData(form.getValues());
		};

		window.addEventListener("beforeunload", emergencySave);
		window.addEventListener("pagehide", emergencySave);

		return () => {
			window.removeEventListener("beforeunload", emergencySave);
			window.removeEventListener("pagehide", emergencySave);
		};
	}, [form, hasHydrated, setFormData]);

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

		// Clear any previous validation error message
		setValidationErrorMessage(null);

		const fieldsToValidate = TAB_FIELD_MAPPING[currentStep];
		const isCurrentStepValid = await form.trigger(fieldsToValidate, {
			shouldFocus: true,
		});

		if (!isCurrentStepValid) {
			// Count errors for this step and announce to screen readers
			const stepErrors = fieldsToValidate.filter(
				(field) => form.formState.errors[field],
			);
			const errorCount = stepErrors.length;
			const message =
				errorCount === 1
					? "1 validation error. Please fix the highlighted field."
					: `${errorCount} validation errors. Please fix the highlighted fields.`;
			setValidationErrorMessage(message);
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

	// Skip current step (only for optional steps)
	const skip = useCallback(() => {
		if (!isValidStep || !isStepOptional(currentStep)) {
			return;
		}

		// Mark step as completed without validation
		setStepCompleted(currentStep);
		saveFormData();

		if (currentIndex < BOOKING_TABS.length - 1) {
			const nextStep = BOOKING_TABS[currentIndex + 1];
			router.push(`/app/${organizationSlug}/bookings/new/${nextStep}`);
		}
	}, [
		currentIndex,
		currentStep,
		isValidStep,
		organizationSlug,
		router,
		saveFormData,
		setStepCompleted,
	]);

	// Check if current step can be skipped
	const canSkipCurrentStep = useMemo(() => {
		return isValidStep && isStepOptional(currentStep);
	}, [currentStep, isValidStep]);

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

	// Clear validation error when user starts fixing errors
	useEffect(() => {
		if (validationErrorMessage && Object.keys(errors).length === 0) {
			setValidationErrorMessage(null);
		}
	}, [errors, validationErrorMessage]);

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
		canSkipCurrentStep,

		// Draft state
		isSaving,

		// Validation announcements (for screen readers)
		validationErrorMessage,

		// Navigation
		canNavigateToStep,
		goToStep,
		next,
		skip,
		previous,
		cancel,
		getFirstIncompleteStep,

		// Helpers
		saveFormData,
		organizationSlug,
	};
}
