"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
	type BookingFormValues,
	type BookingTab,
	defaultBookingValues,
} from "../booking-form-schema";

const STORE_VERSION = 1;

interface BookingFormStore {
	// State
	formData: BookingFormValues;
	completedSteps: BookingTab[];
	_hasHydrated: boolean;

	// Actions
	setFormData: (data: Partial<BookingFormValues>) => void;
	setStepCompleted: (step: BookingTab) => void;
	resetForm: () => void;
	setHasHydrated: (state: boolean) => void;
}

export const useBookingFormStore = create<BookingFormStore>()(
	persist(
		(set) => ({
			formData: defaultBookingValues,
			completedSteps: [],
			_hasHydrated: false,

			setFormData: (data) =>
				set((state) => ({
					formData: { ...state.formData, ...data },
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
				}),

			setHasHydrated: (state) => set({ _hasHydrated: state }),
		}),
		{
			name: "booking-form-draft",
			version: STORE_VERSION,
			// Only persist formData and completedSteps, not UI state
			partialize: (state) => ({
				formData: state.formData,
				completedSteps: state.completedSteps,
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
