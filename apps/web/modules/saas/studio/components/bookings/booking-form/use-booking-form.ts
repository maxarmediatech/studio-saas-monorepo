"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type FieldPath, useForm } from "react-hook-form";
import {
	BOOKING_TABS,
	type BookingFormValues,
	type BookingTab,
	bookingFormSchema,
	defaultBookingValues,
	TAB_FIELD_MAPPING,
} from "./booking-form-schema";

interface UseBookingFormOptions {
	defaultValues?: BookingFormValues;
	onSubmit: (data: BookingFormValues) => void;
	mode?: "create" | "edit";
}

export function useBookingForm({
	defaultValues = defaultBookingValues,
	onSubmit,
	mode = "create",
}: UseBookingFormOptions) {
	const form = useForm<BookingFormValues>({
		resolver: zodResolver(bookingFormSchema),
		defaultValues,
		mode: "onChange",
	});

	// Keep tab state fully client-side to avoid route transitions/reloads on step changes.
	const [activeTab, setActiveTab] = useState<BookingTab>("details");
	const [isNavigating, setIsNavigating] = useState(false);

	// Track which tabs have been completed (visited and moved on from)
	const [completedSteps, setCompletedSteps] = useState<Set<BookingTab>>(
		new Set(),
	);

	// Track which tabs have errors
	const [tabsWithErrors, setTabsWithErrors] = useState<
		Record<BookingTab, boolean>
	>({
		details: false,
		shoots: false,
		payments: false,
		deliverables: false,
		review: false,
	});

	// Update error tracking when form errors change
	useEffect(() => {
		const errorFields = Object.keys(form.formState.errors);
		const newTabsWithErrors = BOOKING_TABS.reduce(
			(acc, tab) => {
				const hasError = errorFields.some((field) =>
					TAB_FIELD_MAPPING[tab].some(
						(tabField) =>
							field === tabField ||
							field.startsWith(`${tabField}.`),
					),
				);
				acc[tab] = hasError;
				return acc;
			},
			{} as Record<BookingTab, boolean>,
		);
		setTabsWithErrors(newTabsWithErrors);
	}, [form.formState.errors]);

	// Reset form after successful submission (create mode only)
	useEffect(() => {
		if (form.formState.isSubmitSuccessful && mode === "create") {
			form.reset(defaultBookingValues);
			setActiveTab("details");
			setCompletedSteps(new Set());
		}
	}, [form.formState.isSubmitSuccessful, form, mode]);

	const currentTabIndex = BOOKING_TABS.indexOf(activeTab);

	const validateTab = useCallback(
		async (tab: BookingTab) => {
			const fields = TAB_FIELD_MAPPING[tab];
			if (fields.length === 0) {
				return true;
			}

			return form.trigger(fields as FieldPath<BookingFormValues>[], {
				shouldFocus: true,
			});
		},
		[form],
	);

	const canNavigateToTab = useCallback(
		(targetTab: BookingTab) => {
			const targetIndex = BOOKING_TABS.indexOf(targetTab);
			if (targetIndex === -1) {
				return false;
			}

			// Always allow going back to any previous step.
			if (targetIndex <= currentTabIndex) {
				return true;
			}

			// Allow going to any already completed step.
			if (completedSteps.has(targetTab)) {
				return true;
			}

			// Allow moving forward by one step.
			return targetIndex === currentTabIndex + 1;
		},
		[completedSteps, currentTabIndex],
	);

	const requestTabChange = useCallback(
		async (newTab: BookingTab) => {
			if (!canNavigateToTab(newTab)) {
				return;
			}

			const targetIndex = BOOKING_TABS.indexOf(newTab);
			if (targetIndex === -1) {
				return;
			}

			// Backwards navigation never blocks.
			if (targetIndex <= currentTabIndex) {
				setActiveTab(newTab);
				return;
			}

			// Forward navigation validates current step before advancing.
			setIsNavigating(true);
			try {
				const currentStep = BOOKING_TABS[currentTabIndex];
				const isValid = await validateTab(currentStep);
				if (!isValid) {
					return;
				}

				setCompletedSteps((prev) => {
					const next = new Set(prev);
					next.add(currentStep);
					return next;
				});
				setActiveTab(newTab);
			} finally {
				setIsNavigating(false);
			}
		},
		[canNavigateToTab, currentTabIndex, validateTab],
	);

	const goToNextTab = useCallback(() => {
		if (currentTabIndex < BOOKING_TABS.length - 1) {
			void requestTabChange(BOOKING_TABS[currentTabIndex + 1]);
		}
	}, [currentTabIndex, requestTabChange]);

	const goToPreviousTab = useCallback(() => {
		if (currentTabIndex > 0) {
			void requestTabChange(BOOKING_TABS[currentTabIndex - 1]);
		}
	}, [currentTabIndex, requestTabChange]);

	const isFirstTab = currentTabIndex === 0;
	const isLastTab = currentTabIndex === BOOKING_TABS.length - 1;

	// Get tabs that have validation errors
	const errorTabs = useMemo(() => {
		return BOOKING_TABS.filter((tab) => tabsWithErrors[tab]);
	}, [tabsWithErrors]);

	const hasErrors = errorTabs.length > 0;
	const isSubmitted = form.formState.isSubmitted;
	const showErrorSummary = isSubmitted && hasErrors;

	return {
		form,
		activeTab,
		handleTabChange: (tab: BookingTab) => void requestTabChange(tab),
		goToNextTab,
		goToPreviousTab,
		isFirstTab,
		isLastTab,
		isNavigating,
		canNavigateToTab,
		errorTabs,
		showErrorSummary,
		tabsWithErrors,
		completedSteps,
		handleSubmit: form.handleSubmit(onSubmit),
		TABS: BOOKING_TABS,
	};
}
