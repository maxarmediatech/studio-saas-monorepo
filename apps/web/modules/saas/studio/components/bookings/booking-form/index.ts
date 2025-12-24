// Main form component
export { BookingForm } from "./BookingForm";

// Step components
export { BookingDetailsStep } from "./BookingDetailsStep";
export { BookingShootsStep } from "./BookingShootsStep";
export { BookingPaymentsStep } from "./BookingPaymentsStep";
export { BookingDeliverablesStep } from "./BookingDeliverablesStep";
export { BookingReviewStep } from "./BookingReviewStep";

// Layout components
export { BookingFormLayout } from "./BookingFormLayout";
export { BookingStepperSidebar } from "./BookingStepperSidebar";
export { BookingMobileStepper } from "./BookingMobileStepper";
export { BookingFormNavigation } from "./BookingFormNavigation";
export { StepIndicator, type StepStatus } from "./step-indicator";

// Hooks
export { useBookingForm } from "./use-booking-form";

// Store (for page-based routing)
export {
	useBookingFormStore,
	useBookingFormHydrated,
} from "./store/use-booking-form-store";

// Schema and types
export {
	bookingFormSchema,
	bookingDetailsStepSchema,
	bookingShootsStepSchema,
	bookingPaymentsStepSchema,
	bookingDeliverablesStepSchema,
	BOOKING_STEP_SCHEMAS,
	defaultBookingValues,
	BOOKING_TABS,
	TAB_LABELS,
	TAB_FIELD_MAPPING,
	SHOOT_TYPE_OPTIONS,
	DELIVERABLE_TYPE_OPTIONS,
	PAYMENT_METHOD_OPTIONS,
	PAYMENT_SCHEDULE_PRESETS,
	STEP_CONFIG,
	type BookingFormValues,
	type BookingTab,
	type ParticipantFormValue,
	type ShootFormValue,
	type PaymentFormValue,
	type PaymentScheduleFormValue,
	type DeliverableFormValue,
	type EventFormValue,
	type StepConfig,
} from "./booking-form-schema";
