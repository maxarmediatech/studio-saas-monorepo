"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
	type BookingFormValues,
	type BookingTab,
	BOOKING_TABS,
	TAB_FIELD_MAPPING,
	bookingFormSchema,
	defaultBookingValues,
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

	// URL-synced tab state
	const [activeTab, setActiveTab] = useQueryState("tab", {
		defaultValue: "details" as string,
		parse: (value) =>
			BOOKING_TABS.includes(value as BookingTab) ? value : "details",
	});

	// Track which tabs have errors
	const [tabsWithErrors, setTabsWithErrors] = useState<Record<string, boolean>>(
		{},
	);

	// Update error tracking when form errors change
	useEffect(() => {
		if (form.formState.errors) {
			const errorFields = Object.keys(form.formState.errors);
			const newTabsWithErrors = BOOKING_TABS.reduce(
				(acc, tab) => {
					const hasError = errorFields.some((field) =>
						TAB_FIELD_MAPPING[tab].some(
							(tabField) =>
								field === tabField || field.startsWith(`${tabField}.`),
						),
					);
					return { ...acc, [tab]: hasError };
				},
				{} as Record<string, boolean>,
			);
			setTabsWithErrors(newTabsWithErrors);
		}
	}, [form.formState.errors]);

	// Reset form after successful submission (create mode only)
	useEffect(() => {
		if (form.formState.isSubmitSuccessful && mode === "create") {
			form.reset(defaultBookingValues);
			setActiveTab("details");
		}
	}, [form.formState.isSubmitSuccessful, form, mode, setActiveTab]);

	const handleTabChange = useCallback(
		(newTab: string) => {
			if (BOOKING_TABS.includes(newTab as BookingTab)) {
				setActiveTab(newTab);
			}
		},
		[setActiveTab],
	);

	const currentTabIndex = BOOKING_TABS.indexOf(activeTab as BookingTab);

	const goToNextTab = useCallback(() => {
		if (currentTabIndex < BOOKING_TABS.length - 1) {
			handleTabChange(BOOKING_TABS[currentTabIndex + 1]);
		}
	}, [currentTabIndex, handleTabChange]);

	const goToPreviousTab = useCallback(() => {
		if (currentTabIndex > 0) {
			handleTabChange(BOOKING_TABS[currentTabIndex - 1]);
		}
	}, [currentTabIndex, handleTabChange]);

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
		activeTab: activeTab as BookingTab,
		handleTabChange,
		goToNextTab,
		goToPreviousTab,
		isFirstTab,
		isLastTab,
		errorTabs,
		showErrorSummary,
		tabsWithErrors,
		handleSubmit: form.handleSubmit(onSubmit),
		TABS: BOOKING_TABS,
	};
}
