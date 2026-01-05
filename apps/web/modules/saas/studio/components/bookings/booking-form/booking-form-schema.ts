import {
	CameraIcon,
	CheckCircleIcon,
	ClipboardListIcon,
	type LucideIcon,
	PackageIcon,
	WalletIcon,
} from "lucide-react";
import { z } from "zod";

/**
 * Uploaded attachment schema - flat metadata object for file uploads
 */
export const uploadedAttachmentSchema = z.object({
	name: z.string(),
	size: z.number(),
	type: z.string(),
	key: z.string(),
	url: z.string(),
});

export type UploadedAttachment = z.infer<typeof uploadedAttachmentSchema>;

/**
 * Decimal string validator for currency inputs.
 * Validates that the string represents a valid decimal number.
 * Does NOT transform the value - form stores raw string, transformation
 * happens at submission time in buildCreateBookingInput.
 */
export const decimalStringSchema = z
	.string()
	.min(1, "Amount is required")
	.refine(
		(val) => {
			const cleaned = val.replace(/[^\d.]/g, "");
			const parsed = Number.parseFloat(cleaned);
			return !Number.isNaN(parsed) && parsed >= 0;
		},
		{ message: "Must be a valid positive number" },
	);

/**
 * Format a decimal string for API submission (ensures 2 decimal places)
 */
export function formatDecimalForApi(value: string): string {
	const cleaned = value.replace(/[^\d.]/g, "");
	const parsed = Number.parseFloat(cleaned);
	if (Number.isNaN(parsed)) {
		return "0.00";
	}
	return parsed.toFixed(2);
}

/**
 * Participant schema - links a client to the booking with a role
 */
export const participantSchema = z.object({
	clientId: z
		.string()
		.regex(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
			"Client is required",
		),
	role: z.string().min(1, "Role is required"),
});

export type ParticipantFormValue = z.infer<typeof participantSchema>;

/**
 * Participants array schema with duplicate prevention
 */
export const participantsArraySchema = z
	.array(participantSchema)
	.min(1, "At least one client is required")
	.refine(
		(participants) => {
			const clientIds = participants
				.map((p) => p.clientId)
				.filter((id) => id && id.length > 0);
			return new Set(clientIds).size === clientIds.length;
		},
		{ message: "Each client can only be added once" },
	);

/**
 * Crew assignment schema with per-shoot rate.
 * Role is auto-filled from crew profile on backend.
 * Rate defaults to crew.dailyRate when selected, can be customized.
 */
export const crewAssignmentSchema = z.object({
	crewId: z.string().min(1, "Crew member is required"),
	rate: z.string().optional(), // Per-shoot rate (decimal string for currency input)
});

export type CrewAssignmentFormValue = z.infer<typeof crewAssignmentSchema>;

/**
 * Shoot schema - photo/video shoots with crew assignments
 *
 * Simplified schema:
 * - shootType serves as both identifier and type (no separate name field)
 * - endTime removed (Indian weddings have flexible end times)
 * - venue + venueAddress merged into single location field
 */
export const shootSchema = z.object({
	shootType: z.string().min(1, "Event type is required"),
	shootDate: z.string().min(1, "Shoot date is required"),
	startTime: z.string().optional(),
	// Max 500 to match API venueAddress field constraint
	location: z.string().max(500, "Location is too long (max 500 characters)").optional(),
	notes: z.string().optional(),
	crewAssignments: z.array(crewAssignmentSchema).optional(),
});

export type ShootFormValue = z.infer<typeof shootSchema>;

/**
 * Payment received schema
 */
export const paymentSchema = z.object({
	amount: decimalStringSchema,
	paymentMethod: z.enum([
		"cash",
		"upi",
		"bank_transfer",
		"cheque",
		"card",
		"other",
	]),
	receivedDate: z.string().min(1, "Payment date is required"),
	transactionReference: z.string().optional(),
	notes: z.string().optional(),
	proofAttachment: uploadedAttachmentSchema.nullable().optional(),
});

export type PaymentFormValue = z.infer<typeof paymentSchema>;

/**
 * Payment schedule schema
 */
export const paymentScheduleSchema = z.object({
	name: z.string().min(1, "Payment name is required"),
	amount: decimalStringSchema,
	dueDate: z.string().min(1, "Due date is required"),
	notes: z.string().optional(),
});

export type PaymentScheduleFormValue = z.infer<typeof paymentScheduleSchema>;

/**
 * Optional decimal string validator for costs that can be left blank.
 * Empty string is treated as "no cost" (distinct from zero).
 */
export const optionalDecimalStringSchema = z
	.string()
	.refine(
		(val) => {
			if (val === "" || val === undefined) {
				return true; // Allow empty
			}
			const cleaned = val.replace(/[^\d.]/g, "");
			const parsed = Number.parseFloat(cleaned);
			return !Number.isNaN(parsed) && parsed >= 0;
		},
		{ message: "Must be a valid positive number" },
	)
	.optional();

/**
 * Deliverable schema
 */
export const deliverableSchema = z.object({
	name: z.string().min(1, "Deliverable name is required"),
	deliverableType: z.string().min(1, "Deliverable type is required"),
	description: z.string().optional(),
	dueDate: z.string().optional(),
	crewAssignments: z.array(crewAssignmentSchema).optional(),
	// Package relationship fields
	quantity: z.number().int().min(1).default(1),
	cost: optionalDecimalStringSchema, // Only for custom deliverables (not package-included)
	isPackageIncluded: z.boolean().default(false),
});

export type DeliverableFormValue = z.infer<typeof deliverableSchema>;

/**
 * Main booking form schema
 */
export const bookingFormSchema = z.object({
	// Step 1: Details
	name: z.string().min(1, "Booking name is required"),
	bookingType: z.string().min(1, "Booking type is required"),
	packageType: z.string().min(1, "Package type is required"),
	packageCost: decimalStringSchema,
	note: z.string().optional(),
	contractAttachment: uploadedAttachmentSchema.nullable().optional(),
	participants: participantsArraySchema,

	// Step 2: Payments
	payments: z.array(paymentSchema).optional(),
	paymentSchedules: z.array(paymentScheduleSchema).optional(),

	// Step 3: Shoots
	shoots: z.array(shootSchema).optional(),

	// Step 4: Deliverables
	deliverables: z.array(deliverableSchema).optional(),
});

export type BookingFormValues = z.input<typeof bookingFormSchema>;

export const bookingDetailsStepSchema = bookingFormSchema.pick({
	name: true,
	bookingType: true,
	packageType: true,
	packageCost: true,
	note: true,
	contractAttachment: true,
	participants: true,
});

export const bookingShootsStepSchema = bookingFormSchema.pick({
	shoots: true,
});

export const bookingPaymentsStepSchema = bookingFormSchema.pick({
	payments: true,
	paymentSchedules: true,
});

export const bookingDeliverablesStepSchema = bookingFormSchema.pick({
	deliverables: true,
});

/**
 * Default form values
 */
export function createDefaultBookingValues(): BookingFormValues {
	return {
		name: "",
		bookingType: "",
		packageType: "",
		packageCost: "0.00",
		note: "",
		contractAttachment: null,
		participants: [
			{
				clientId: "",
				role: "",
			},
		],
		shoots: [],
		payments: [],
		paymentSchedules: [],
		deliverables: [],
	};
}

export const defaultBookingValues: BookingFormValues =
	createDefaultBookingValues();

/**
 * Tab configuration for multi-step wizard
 */
export const BOOKING_TABS = [
	"details",
	"payments",
	"shoots",
	"deliverables",
	"review",
] as const;
export type BookingTab = (typeof BOOKING_TABS)[number];

export const BOOKING_STEP_SCHEMAS: Record<BookingTab, z.ZodTypeAny> = {
	details: bookingDetailsStepSchema,
	shoots: bookingShootsStepSchema,
	payments: bookingPaymentsStepSchema,
	deliverables: bookingDeliverablesStepSchema,
	review: bookingFormSchema,
};

/**
 * Mapping of tabs to their form fields (for error tracking)
 */
export const TAB_FIELD_MAPPING: Record<
	BookingTab,
	(keyof BookingFormValues)[]
> = {
	details: [
		"name",
		"bookingType",
		"packageType",
		"packageCost",
		"note",
		"contractAttachment",
		"participants",
	],
	shoots: ["shoots"],
	payments: ["payments", "paymentSchedules"],
	deliverables: ["deliverables"],
	review: [], // No form fields - just displays summary
};

/**
 * Tab labels for display
 */
export const TAB_LABELS: Record<BookingTab, string> = {
	details: "Details",
	shoots: "Shoots",
	payments: "Payments",
	deliverables: "Deliverables",
	review: "Review",
};

/**
 * Common shoot types
 */
export const SHOOT_TYPE_OPTIONS = [
	{ value: "pre_wedding", label: "Pre-Wedding" },
	{ value: "wedding", label: "Wedding" },
	{ value: "reception", label: "Reception" },
	{ value: "engagement", label: "Engagement" },
	{ value: "mehendi", label: "Mehendi" },
	{ value: "sangeet", label: "Sangeet" },
	{ value: "haldi", label: "Haldi" },
	{ value: "portrait", label: "Portrait" },
	{ value: "maternity", label: "Maternity" },
	{ value: "baby_shoot", label: "Baby Shoot" },
	{ value: "corporate", label: "Corporate" },
	{ value: "other", label: "Other" },
] as const;

/**
 * Common deliverable types
 */
export const DELIVERABLE_TYPE_OPTIONS = [
	{ value: "wedding_album", label: "Wedding Album" },
	{ value: "pre_wedding_album", label: "Pre-Wedding Album" },
	{ value: "photo_album", label: "Photo Album" },
	{ value: "highlight_video", label: "Highlight Video" },
	{ value: "full_video", label: "Full Video" },
	{ value: "teaser", label: "Teaser" },
	{ value: "reel", label: "Reel" },
	{ value: "edited_photos", label: "Edited Photos" },
	{ value: "raw_photos", label: "Raw Photos" },
	{ value: "raw_videos", label: "Raw Videos" },
	{ value: "drone_footage", label: "Drone Footage" },
	{ value: "frame", label: "Frame" },
	{ value: "canvas", label: "Canvas" },
	{ value: "other", label: "Other" },
] as const;

/**
 * Payment method options
 */
export const PAYMENT_METHOD_OPTIONS = [
	{ value: "cash", label: "Cash" },
	{ value: "upi", label: "UPI" },
	{ value: "bank_transfer", label: "Bank Transfer" },
	{ value: "cheque", label: "Cheque" },
	{ value: "card", label: "Card" },
	{ value: "other", label: "Other" },
] as const;

/**
 * Common payment schedule names
 */
export const PAYMENT_SCHEDULE_PRESETS = [
	{ value: "advance", label: "Advance Payment" },
	{ value: "before_wedding", label: "Before Wedding" },
	{ value: "after_wedding", label: "After Wedding" },
	{ value: "before_delivery", label: "Before Delivery" },
	{ value: "final", label: "Final Payment" },
] as const;

/**
 * Step configuration for the booking wizard
 */
export interface StepConfig {
	id: BookingTab;
	label: string;
	description: string;
	icon: LucideIcon;
	/** Whether this step can be skipped (no required fields) */
	optional: boolean;
}

export const STEP_CONFIG: StepConfig[] = [
	{
		id: "details",
		label: "Details",
		description: "Booking info & clients",
		icon: ClipboardListIcon,
		optional: false,
	},
	{
		id: "payments",
		label: "Payments",
		description: "Record and plan payments",
		icon: WalletIcon,
		optional: true,
	},
	{
		id: "shoots",
		label: "Shoots",
		description: "Schedule photo/video sessions",
		icon: CameraIcon,
		optional: true,
	},
	{
		id: "deliverables",
		label: "Deliverables",
		description: "Define final outputs",
		icon: PackageIcon,
		optional: true,
	},
	{
		id: "review",
		label: "Review",
		description: "Review & submit",
		icon: CheckCircleIcon,
		optional: false,
	},
];

/**
 * Helper to check if a step is optional
 */
export function isStepOptional(step: BookingTab): boolean {
	return STEP_CONFIG.find((s) => s.id === step)?.optional ?? false;
}

/**
 * Route builder for booking form navigation.
 * Centralizes URL construction to avoid string interpolation duplication.
 */
export const bookingFormRoutes = {
	/** Get the base bookings list route */
	list: (organizationSlug: string) => `/app/${organizationSlug}/bookings`,

	/** Get the new booking wizard base route */
	new: (organizationSlug: string) => `/app/${organizationSlug}/bookings/new`,

	/** Get a specific step route in the new booking wizard */
	step: (organizationSlug: string, step: BookingTab) =>
		`/app/${organizationSlug}/bookings/new/${step}`,

	/** Get the next step route (returns undefined if already at last step) */
	nextStep: (organizationSlug: string, currentStep: BookingTab) => {
		const currentIndex = BOOKING_TABS.indexOf(currentStep);
		if (currentIndex === -1 || currentIndex >= BOOKING_TABS.length - 1) {
			return undefined;
		}
		return `/app/${organizationSlug}/bookings/new/${BOOKING_TABS[currentIndex + 1]}`;
	},

	/** Get the previous step route (returns undefined if already at first step) */
	prevStep: (organizationSlug: string, currentStep: BookingTab) => {
		const currentIndex = BOOKING_TABS.indexOf(currentStep);
		if (currentIndex <= 0) {
			return undefined;
		}
		return `/app/${organizationSlug}/bookings/new/${BOOKING_TABS[currentIndex - 1]}`;
	},
} as const;

/**
 * Clean up empty/incomplete array items before validation or submission.
 * Removes items that are essentially empty (user added but didn't fill in).
 */
export function cleanupFormArrays(
	values: BookingFormValues,
): BookingFormValues {
	return {
		...values,
		// Keep participants with valid clientId (required field)
		participants: values.participants.filter(
			(p) => p.clientId && p.clientId.length > 0,
		),
		// Keep shoots with shootType (required field - serves as identifier)
		shoots: values.shoots?.filter(
			(s) => s.shootType && s.shootType.length > 0,
		),
		// Keep payments with amount (required field)
		payments: values.payments?.filter(
			(p) =>
				p.amount &&
				p.amount.length > 0 &&
				p.amount !== "0" &&
				p.amount !== "0.00",
		),
		// Keep payment schedules with name (required field)
		paymentSchedules: values.paymentSchedules?.filter(
			(p) => p.name && p.name.length > 0,
		),
		// Keep deliverables with name (required field)
		deliverables: values.deliverables?.filter(
			(d) => d.name && d.name.length > 0,
		),
	};
}
