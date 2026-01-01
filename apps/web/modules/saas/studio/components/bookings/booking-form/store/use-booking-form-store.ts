"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
	type BookingFormValues,
	type BookingTab,
	BOOKING_STEP_SCHEMAS,
	BOOKING_TABS,
	defaultBookingValues,
	isStepOptional,
} from "../booking-form-schema";

const STORE_VERSION = 1;

/**
 * Validate if a step is actually complete based on form data.
 * Optional steps are always considered complete.
 * Required steps must pass schema validation.
 */
function isStepActuallyComplete(
	step: BookingTab,
	formData: BookingFormValues,
): boolean {
	// Optional steps are always valid (empty is ok)
	if (isStepOptional(step)) {
		return true;
	}

	// Review step has no fields to validate
	if (step === "review") {
		return true;
	}

	// Validate using step schema
	const schema = BOOKING_STEP_SCHEMAS[step];
	const result = schema.safeParse(formData);
	return result.success;
}

/**
 * Re-validate all completed steps and filter out stale ones.
 */
function revalidateCompletedSteps(
	completedSteps: BookingTab[],
	formData: BookingFormValues,
): BookingTab[] {
	return completedSteps.filter((step) =>
		isStepActuallyComplete(step, formData),
	);
}

interface BookingFormStore {
	// State
	formData: BookingFormValues;
	completedSteps: BookingTab[];
	_hasHydrated: boolean;
	_lastSavedAt: number | null;

	// Actions
	setFormData: (data: Partial<BookingFormValues>) => void;
	setStepCompleted: (step: BookingTab) => void;
	resetForm: () => void;
	setHasHydrated: (state: boolean) => void;
	revalidateSteps: () => void;
}

export const useBookingFormStore = create<BookingFormStore>()(
	persist(
		(set) => ({
			formData: defaultBookingValues,
			completedSteps: [],
			_hasHydrated: false,
			_lastSavedAt: null,

			setFormData: (data) =>
				set((state) => ({
					formData: { ...state.formData, ...data },
					_lastSavedAt: Date.now(),
				})),

			setStepCompleted: (step) =>
				set((state) => ({
					completedSteps: state.completedSteps.includes(step)
						? state.completedSteps
						: [...state.completedSteps, step],
				})),

			resetForm: () =>
				set({
					formData: defaultBookingValues,
					completedSteps: [],
					_lastSavedAt: null,
				}),

			setHasHydrated: (state) => set({ _hasHydrated: state }),

			revalidateSteps: () =>
				set((state) => ({
					completedSteps: revalidateCompletedSteps(
						state.completedSteps,
						state.formData,
					),
				})),
		}),
		{
			name: "booking-form-draft",
			version: STORE_VERSION,
			// Persist form data, completed steps, and last saved timestamp
			partialize: (state) => ({
				formData: state.formData,
				completedSteps: state.completedSteps,
				_lastSavedAt: state._lastSavedAt,
			}),
			onRehydrateStorage: () => (state) => {
				state?.setHasHydrated(true);
			},
		},
	),
);

/**
 * Hook to check if the store has hydrated from localStorage.
 * Use this to prevent hydration mismatches in SSR.
 */
export function useBookingFormHydrated() {
	return useBookingFormStore((state) => state._hasHydrated);
}

/**
 * Hook to get the timestamp of the last draft save.
 * Returns null if never saved, timestamp otherwise.
 */
export function useLastSavedAt() {
	return useBookingFormStore((state) => state._lastSavedAt);
}
